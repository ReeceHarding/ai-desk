import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DebugChunk {
  docId: string;
  docTitle?: string;
  text: string;
  similarity: number;
}

interface DebugToastProps {
  chunks: DebugChunk[];
  processingTimeMs: number;
}

export function DebugToast({ chunks, processingTimeMs }: DebugToastProps) {
  return (
    <div className="max-w-[350px]">
      <Collapsible>
        <CollapsibleTrigger className="text-sm font-medium">
          Show RAG process details
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ScrollArea className="h-[300px] w-full rounded-md border p-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Knowledge Base Chunks Used:</h4>
                {chunks.map((chunk, idx) => (
                  <div key={idx} className="mt-2 text-sm">
                    <p className="font-medium">Chunk {idx + 1}:</p>
                    <p className="text-muted-foreground">
                      Document: {chunk.docTitle || chunk.docId}
                    </p>
                    <p className="text-muted-foreground">
                      Similarity: {(chunk.similarity * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Preview: {chunk.text.substring(0, 100)}...
                    </p>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="font-medium">Processing Time:</h4>
                <p className="text-sm text-muted-foreground">
                  {processingTimeMs}ms
                </p>
              </div>
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
} 