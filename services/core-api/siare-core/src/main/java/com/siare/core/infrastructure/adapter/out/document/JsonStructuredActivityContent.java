package com.siare.core.infrastructure.adapter.out.document;
import com.siare.core.application.port.out.StructuredActivityContent;
import com.siare.core.domain.activity.*;
import tools.jackson.databind.*;
public final class JsonStructuredActivityContent implements StructuredActivityContent {
    private final ObjectMapper json;
    public JsonStructuredActivityContent(ObjectMapper json) { this.json=json; }
    @Override public ActivityBank read(String text) {
        if(text==null || text.length()>1000000 || !text.stripLeading().startsWith("{")) throw ActivityException.insufficient();
        try { return json.readerFor(ActivityBank.class).with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).readValue(text); }
        catch(RuntimeException error) { throw ActivityException.insufficient(); }
    }
}
