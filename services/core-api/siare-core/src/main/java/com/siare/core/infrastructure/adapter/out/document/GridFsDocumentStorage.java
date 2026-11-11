package com.siare.core.infrastructure.adapter.out.document;

import com.siare.core.application.port.out.DocumentStorage;
import com.siare.core.domain.document.DocumentException;
import java.io.*;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.data.mongodb.core.query.*;

public final class GridFsDocumentStorage implements DocumentStorage {
    private final GridFsTemplate grid;
    public GridFsDocumentStorage(GridFsTemplate grid) { this.grid = grid; }
    @Override public String store(InputStream source, String filename, String contentType) {
        return grid.store(source, filename, contentType).toHexString();
    }
    @Override public InputStream open(String id) {
        var file = grid.findOne(Query.query(Criteria.where("_id").is(new ObjectId(id))));
        if (file == null) throw new DocumentException(503, "STORAGE_ERROR", "El archivo original no está disponible.");
        try { return grid.getResource(file).getInputStream(); }
        catch (IOException error) { throw new DocumentException(503, "STORAGE_ERROR", "No se pudo leer el archivo original."); }
    }
    @Override public void delete(String id) { grid.delete(Query.query(Criteria.where("_id").is(new ObjectId(id)))); }
}
