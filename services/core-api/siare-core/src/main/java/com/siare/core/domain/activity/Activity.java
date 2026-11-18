package com.siare.core.domain.activity;

/** Server-side activity. Web adapters must explicitly project a view without solutions. */
public interface Activity {
    ActivityFamily family();
}
