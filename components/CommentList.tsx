interface Comment {
  id: string;
  content: string;
  created_at: string;
  author: {
    display_name: string;
    role: string;
  };
}

interface Props {
  comments: Comment[];
}

export default function CommentList({ comments }: Props) {
  return (
    <div className="space-y-6">
      {comments.map((comment) => (
        <div key={comment.id} className="bg-white shadow sm:rounded-lg p-4">
          <div className="flex space-x-3">
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  {comment.author.display_name}
                  {comment.author.role === 'agent' && (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Support Agent
                    </span>
                  )}
                </h3>
                <p className="text-sm text-gray-500">
                  {new Date(comment.created_at).toLocaleString()}
                </p>
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {comment.content}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} 