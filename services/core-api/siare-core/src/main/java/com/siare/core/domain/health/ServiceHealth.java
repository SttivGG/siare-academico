package com.siare.core.domain.health;

/** Public health contains no infrastructure details. */
public record ServiceHealth(Status status) {
    public enum Status { UP, DOWN }
}
