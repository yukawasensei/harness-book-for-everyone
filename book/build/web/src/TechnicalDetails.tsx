import React, { type ReactNode } from "react";

export function TechnicalDetails({ children }: { children: ReactNode }) {
  return <details className="technical-details"><summary>技术详情</summary>{children}</details>;
}
