import os
from pinecone import Pinecone

# Initialize Pinecone
pc = Pinecone(
    api_key=os.environ.get('PINECONE_API_KEY')
)

# Connect to the index
index_name = os.environ.get('PINECONE_INDEX', 'ai-desk-rag-embeddings')
index = pc.Index(index_name)

# Document IDs from the logs
doc_ids = [
    "94de6162-81ea-447f-80cc-a2ee9ab11115",  # LCBR FAQ
    "f8fb3884-55d8-4620-9b08-f427625c2580"   # ChatGenius PDF
]

for doc_id in doc_ids:
    print(f"\nChecking chunks for document: {doc_id}")
    print("=" * 50)
    
    # Construct vector IDs based on the document ID and chunk indices
    vector_ids = []
    if doc_id == doc_ids[0]:  # First document had 2 chunks
        vector_ids = [f"{doc_id}_{i}" for i in range(2)]
    else:  # Second document had 7 chunks
        vector_ids = [f"{doc_id}_{i}" for i in range(7)]
    
    try:
        results = index.fetch(ids=vector_ids)
        
        for vector_id in vector_ids:
            print(f"\nVector ID: {vector_id}")
            if vector_id in results.vectors:
                vector = results.vectors[vector_id]
                print("Metadata:")
                if hasattr(vector, 'metadata'):
                    for key, value in vector.metadata.items():
                        if key == 'text':
                            # Show first 100 chars of text
                            print(f"  {key}: {value[:100]}...")
                        else:
                            print(f"  {key}: {value}")
                else:
                    print("  No metadata found")
            else:
                print("  Vector not found")
            print("-" * 50)
    except Exception as e:
        print(f"Error fetching vectors: {e}") 
