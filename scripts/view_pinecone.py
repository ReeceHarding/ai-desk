import os
from pinecone import Pinecone

def main():
    # Initialize Pinecone
    pc = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))

    # List all indexes
    print("\n=== Pinecone Indexes ===")
    indexes = pc.list_indexes()
    print(f"Available indexes: {indexes.names()}")

    # Get our specific index
    index_name = os.getenv('PINECONE_INDEX_NAME', 'ai-desk-rag-embeddings')
    if index_name in indexes.names():
        index = pc.Index(index_name)
        
        # Get index statistics
        print(f"\n=== Statistics for index '{index_name}' ===")
        stats = index.describe_index_stats()
        print(f"Total vector count: {stats.total_vector_count}")
        print(f"Dimension: {stats.dimension}")
        
        # Fetch some sample vectors
        print(f"\n=== Most Recent Vectors (with metadata) ===")
        try:
            # Query with a dummy vector to get samples
            dummy_vector = [0.0] * stats.dimension
            results = index.query(
                vector=dummy_vector,
                top_k=10,
                include_metadata=True
            )
            
            # Group matches by docId to see different documents
            docs = {}
            for match in results.matches:
                doc_id = match.metadata.get('docId', 'unknown')
                if doc_id not in docs:
                    docs[doc_id] = []
                docs[doc_id].append(match)
            
            # Print information grouped by document
            for doc_id, matches in docs.items():
                print(f"\n=== Document: {doc_id} ===")
                for match in matches:
                    print(f"\nChunk Index: {match.metadata.get('chunkIndex', 'unknown')}")
                    print(f"Token Length: {match.metadata.get('tokenLength', 'unknown')}")
                    print(f"Organization ID: {match.metadata.get('orgId', 'unknown')}")
                    if 'text' in match.metadata:
                        print(f"Text Content: {match.metadata['text'][:200]}...")
                    else:
                        print("No text content stored in metadata")
        except Exception as e:
            print(f"Error querying vectors: {e}")
    else:
        print(f"Index '{index_name}' not found!")

if __name__ == "__main__":
    main() 