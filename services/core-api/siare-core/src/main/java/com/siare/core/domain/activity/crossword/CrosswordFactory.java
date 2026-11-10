package com.siare.core.domain.activity.crossword;

import com.siare.core.domain.activity.factory.ActivityFactory;

/** Family contract only. All three concrete products remain pending. */
public interface CrosswordFactory extends ActivityFactory<Crossword, CrosswordSubmission> { }
