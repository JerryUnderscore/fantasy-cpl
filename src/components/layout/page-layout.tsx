import type { ReactNode } from "react";

type PageLayoutProps = {
  children: ReactNode;
  className?: string;
};

export default function PageLayout({ children, className }: PageLayoutProps) {
  return (
    <div
      className={`mx-auto flex w-full max-w-5xl flex-col gap-8 ${
        className ?? ""
      }`}
    >
      {children}
    </div>
  );
}
