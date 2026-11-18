package com.siare.core.domain.activity.crossword;
import com.siare.core.domain.activity.*;
import java.util.List;
public record CrosswordActivity(int rows,int columns,List<Placement> placements) implements Crossword {
    public CrosswordActivity { placements=List.copyOf(placements); }
    public enum Direction { ACROSS, DOWN }
    public record Placement(ActivityBank.Word word,int row,int column,Direction direction,int number) { }
    @Override public ActivityFamily family() { return ActivityFamily.CROSSWORD; }
    @Override public String toString() { return "CrosswordActivity[REDACTED]"; }
}
