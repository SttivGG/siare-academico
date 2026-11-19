"""Fail closed Linux sandbox installed before importing any document parser.

Landlock hides service process state/secrets and permits writes only to this job's
scratch directory. Seccomp denies network and process inspection, including in OCR
children. The parent still owns the deadline and kills the whole process group.
"""
import ctypes
import errno
import os
import resource
import sys


def restrict(source: str, scratch: str) -> None:
    if sys.platform != "linux" or os.getuid() == 0 or os.uname().machine not in ("x86_64", "aarch64"):
        raise RuntimeError("Linux unprivileged parser sandbox required")
    resource.setrlimit(resource.RLIMIT_AS, (384 * 1024 * 1024,) * 2)
    resource.setrlimit(resource.RLIMIT_CPU, (20, 20))
    resource.setrlimit(resource.RLIMIT_FSIZE, (8 * 1024 * 1024,) * 2)
    resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
    # NPROC counts every thread sharing this host UID, including other containers.
    # The service cgroup imposes the tighter, per-container 64-task ceiling.
    resource.setrlimit(resource.RLIMIT_NPROC, (256, 256))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(38, 1, 0, 0, 0) != 0:  # PR_SET_NO_NEW_PRIVS
        raise OSError(ctypes.get_errno(), "no_new_privs")

    class Ruleset(ctypes.Structure):
        _fields_ = [("handled_access_fs", ctypes.c_uint64)]

    class PathRule(ctypes.Structure):
        _pack_ = 1
        _fields_ = [("allowed_access", ctypes.c_uint64), ("parent_fd", ctypes.c_int32)]

    # Linux generic syscall numbers on the supported amd64/arm64 container images.
    abi = libc.syscall(444, 0, 0, 1)
    if abi < 3:
        # ABI 1/2 cannot deny file truncation. Do not silently weaken filesystem isolation.
        raise RuntimeError("Landlock ABI 3 required")
    rights = (1 << (15 if abi >= 3 else 14 if abi >= 2 else 13)) - 1
    ruleset = Ruleset(rights)
    fd = libc.syscall(444, ctypes.byref(ruleset), ctypes.sizeof(ruleset), 0)
    if fd < 0:
        raise OSError(ctypes.get_errno(), "Landlock ruleset")
    try:
        def allow(path, access):
            if not os.path.exists(path):
                return
            directory = os.path.isdir(path)
            path_fd = os.open(path, os.O_PATH | os.O_CLOEXEC)
            try:
                rule = PathRule(access if directory else access & (1 | 2 | 4 | (1 << 14)), path_fd)
                if libc.syscall(445, fd, 1, ctypes.byref(rule), 0) != 0:
                    raise OSError(ctypes.get_errno(), "Landlock path")
            finally:
                os.close(path_fd)

        for path in ("/usr", "/lib", "/lib64", "/app", "/etc/fonts", "/etc/ld.so.cache", "/etc/localtime"):
            allow(path, 1 | 4 | 8)
        allow(source, 4)
        allow(scratch, rights & ~1)  # temporary files cannot be executed
        allow("/dev/null", 2 | 4)
        allow("/dev/urandom", 4)
        if libc.syscall(446, fd, 0) != 0:
            raise OSError(ctypes.get_errno(), "Landlock restrict")
    finally:
        os.close(fd)

    seccomp = ctypes.CDLL("libseccomp.so.2", use_errno=True)
    seccomp.seccomp_init.argtypes = [ctypes.c_uint32]
    seccomp.seccomp_init.restype = ctypes.c_void_p
    seccomp.seccomp_rule_add.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int, ctypes.c_uint]
    seccomp.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]
    seccomp.seccomp_load.argtypes = [ctypes.c_void_p]
    seccomp.seccomp_release.argtypes = [ctypes.c_void_p]
    context = seccomp.seccomp_init(0x7FFF0000)  # SCMP_ACT_ALLOW
    if not context:
        raise RuntimeError("seccomp unavailable")
    try:
        for name in ("socket", "socketpair", "connect", "bind", "listen", "accept", "accept4", "sendto", "sendmsg",
                     "ptrace", "process_vm_readv", "process_vm_writev", "pidfd_getfd", "mount", "unshare", "setns", "bpf", "keyctl"):
            number = seccomp.seccomp_syscall_resolve_name(name.encode())
            if number >= 0 and seccomp.seccomp_rule_add(context, 0x00050000 | errno.EPERM, number, 0) != 0:
                raise RuntimeError("seccomp rule")
        if seccomp.seccomp_load(context) != 0:
            raise RuntimeError("seccomp load")
    finally:
        seccomp.seccomp_release(context)
