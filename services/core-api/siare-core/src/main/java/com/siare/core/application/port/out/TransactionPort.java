package com.siare.core.application.port.out;

import java.util.function.Supplier;

public interface TransactionPort { <T> T required(Supplier<T> work); }
