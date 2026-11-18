package com.siare.core.domain.activity.crossword;

import com.siare.core.domain.activity.*;
import com.siare.core.domain.activity.factory.Generator;
import java.util.*;
import static com.siare.core.domain.activity.crossword.CrosswordActivity.*;

/** Bounded backtracking: every new word crosses the connected component. No touching side words. */
public final class CrosswordGenerator implements Generator<Crossword> {
    private record Candidate(ActivityBank.Word word,int row,int column,Direction direction) { }
    @Override public Crossword generate(GenerationRequest request) {
        var words=request.bank().words().stream().filter(w->w.topic().equals(request.topic())).sorted(
                Comparator.comparingInt((ActivityBank.Word w)->w.answer().length()).reversed().thenComparing(ActivityBank.Word::id)).toList();
        if(request.count()<2 || request.count()>12 || words.size()<request.count()) throw ActivityException.insufficient();
        words=words.subList(0,request.count());
        int size=request.gridSize();
        if(words.stream().anyMatch(w->w.answer().length()>size)) throw impossible();
        var placed=new ArrayList<Candidate>(); var budget=new int[]{50000};
        // Explore all translations of the longest first word; rotations are symmetric on a square.
        boolean solved=false;
        for(int row=0;row<size && !solved && budget[0]>0;row++) for(int col=0;col<=size-words.getFirst().answer().length() && !solved && budget[0]>0;col++) {
            placed.clear(); placed.add(new Candidate(words.getFirst(),row,col,Direction.ACROSS));
            solved=search(words,placed,size,budget);
        }
        if(!solved) throw impossible();
        int minR=placed.stream().mapToInt(Candidate::row).min().orElseThrow(),minC=placed.stream().mapToInt(Candidate::column).min().orElseThrow();
        int maxR=0,maxC=0;
        for(var p:placed) { maxR=Math.max(maxR,p.row()+(p.direction()==Direction.DOWN ? p.word().answer().length()-1 : 0)); maxC=Math.max(maxC,p.column()+(p.direction()==Direction.ACROSS ? p.word().answer().length()-1 : 0)); }
        var starts=new TreeSet<Integer>(); for(var p:placed) starts.add(p.row()*size+p.column());
        var numbers=new HashMap<Integer,Integer>(); int number=1; for(int start:starts) numbers.put(start,number++);
        return new CrosswordActivity(maxR-minR+1,maxC-minC+1,placed.stream().map(p->new Placement(p.word(),p.row()-minR,p.column()-minC,
                p.direction(),numbers.get(p.row()*size+p.column()))).sorted(Comparator.comparingInt(Placement::number).thenComparing(Placement::direction)).toList());
    }
    private boolean search(List<ActivityBank.Word> words,List<Candidate> placed,int size,int[] budget) {
        if(placed.size()==words.size()) return true;
        if(--budget[0]<=0) return false;
        char[][] cells=new char[size][size]; int[][] mask=new int[size][size];
        for(var p:placed) for(int i=0;i<p.word().answer().length();i++) {
            int r=p.row()+(p.direction()==Direction.DOWN?i:0),c=p.column()+(p.direction()==Direction.ACROSS?i:0);
            cells[r][c]=p.word().answer().charAt(i); mask[r][c]|=p.direction()==Direction.ACROSS?1:2;
        }
        for(var word:words) {
            if(placed.stream().anyMatch(p->p.word().id().equals(word.id()))) continue;
            var candidates=new LinkedHashSet<Candidate>();
            for(int r=0;r<size;r++) for(int c=0;c<size;c++) if(cells[r][c]!=0) for(int i=0;i<word.answer().length();i++)
                if(cells[r][c]==word.answer().charAt(i)) {
                    if(mask[r][c]==1) candidates.add(new Candidate(word,r-i,c,Direction.DOWN));
                    if(mask[r][c]==2) candidates.add(new Candidate(word,r,c-i,Direction.ACROSS));
                }
            for(var candidate:candidates) {
                if(--budget[0]<=0) return false;
                if(!fits(candidate,cells,mask,size)) continue;
                placed.add(candidate); if(search(words,placed,size,budget)) return true; placed.removeLast();
            }
        }
        return false;
    }
    private boolean fits(Candidate p,char[][] cells,int[][] mask,int size) {
        int dr=p.direction()==Direction.DOWN?1:0,dc=1-dr,n=p.word().answer().length(),bit=dr==0?1:2;
        int endR=p.row()+dr*(n-1),endC=p.column()+dc*(n-1);
        if(p.row()<0 || p.column()<0 || endR>=size || endC>=size) return false;
        if(occupied(cells,p.row()-dr,p.column()-dc,size) || occupied(cells,endR+dr,endC+dc,size)) return false;
        int crosses=0;
        for(int i=0;i<n;i++) {
            int r=p.row()+dr*i,c=p.column()+dc*i;
            if(cells[r][c]!=0) {
                if(cells[r][c]!=p.word().answer().charAt(i) || (mask[r][c]&bit)!=0) return false;
                crosses++;
            } else if(occupied(cells,r-dc,c-dr,size) || occupied(cells,r+dc,c+dr,size)) return false;
        }
        return crosses>0;
    }
    private boolean occupied(char[][] grid,int row,int col,int size) { return row>=0 && col>=0 && row<size && col<size && grid[row][col]!=0; }
    private ActivityException impossible() { return new ActivityException(422,"INVALID_CROSSWORD","No se encontró una cuadrícula conectada válida dentro del tamaño y presupuesto de búsqueda. Cambia las palabras o amplía la cuadrícula."); }
}
