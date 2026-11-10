package com.siare.core.domain.activity.quiz;

import com.siare.core.domain.activity.factory.ActivityFactory;

/** Family contract only. All three concrete products remain pending. */
public interface QuizFactory extends ActivityFactory<Quiz, QuizSubmission> { }
