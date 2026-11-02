import React from "react";
import { readableError } from "./presentation";
import { TechnicalDetails } from "./TechnicalDetails";

export function ErrorDetails({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return <details className="error-details"><summary>查看过程错误（{errors.length}）</summary>
    <ol className="error-reasons">{errors.map((raw, index) => <li key={index}>
      <p>{readableError(raw)}</p>
      <TechnicalDetails><pre>{raw}</pre></TechnicalDetails>
    </li>)}</ol>
  </details>;
}
