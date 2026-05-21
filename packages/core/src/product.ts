import { type ProductDecl } from "./syntax";
import { termPattern, type PatternTerm, type RewriteRule } from "./rewrite";

export function productProjectionRules(product: ProductDecl): RewriteRule[] {
  const left = termPattern("left");
  const right = termPattern("right");
  const pair: PatternTerm = { kind: "productPair", product: product.product, left, right };

  return [
    {
      id: `${product.product.name}.product.pi1`,
      name: `${product.product.name}.product.pi1`,
      lhs: {
        kind: "comp",
        first: pair,
        second: { kind: "productProjection", product: product.product, side: "left" }
      },
      rhs: left,
      tags: ["simp", "product", "universal"]
    },
    {
      id: `${product.product.name}.product.pi2`,
      name: `${product.product.name}.product.pi2`,
      lhs: {
        kind: "comp",
        first: pair,
        second: { kind: "productProjection", product: product.product, side: "right" }
      },
      rhs: right,
      tags: ["simp", "product", "universal"]
    }
  ];
}
