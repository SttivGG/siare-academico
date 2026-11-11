package com.siare.core;

import com.siare.core.infrastructure.adapter.out.security.LocalPasswordAdapter;
import java.util.Arrays;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class PasswordPerformanceTests {
    @Test void measuresConfiguredArgon2idWithoutMachineDependentLatencyAssertions() {
        var adapter=new LocalPasswordAdapter(19456,2,1);
        String password="Frase sintética para medir recursos de SIARE";
        adapter.hash(password);
        long[] measurements=new long[7];
        for(int i=0;i<measurements.length;i++) {
            long start=System.nanoTime(); var hash=adapter.hash(password);
            measurements[i]=(System.nanoTime()-start)/1_000_000;
            assertThat(hash).startsWith("$argon2id$v=19$m=19456,t=2,p=1$");
            assertThat(adapter.matches(password,hash)).isTrue();
        }
        Arrays.sort(measurements);
        System.out.printf("Argon2id m=19456 KiB t=2 p=1: median=%d ms max=%d ms, 7 samples, at most 2 concurrent hashes.%n",measurements[3],measurements[6]);
    }
}
