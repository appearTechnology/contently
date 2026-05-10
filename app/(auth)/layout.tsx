export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-muted/30 flex min-h-full flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
