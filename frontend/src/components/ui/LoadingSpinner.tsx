interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto motion-reduce:animate-none"></div>
        {message && (
          <p className="mt-4 text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  );
}
