import { memo } from "react";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

const remarkPlugins = [remarkGfm],
  rehypePlugins = [rehypeSanitize, rehypeHighlight];
const WikiPreview = memo(function WikiPreview({ source }: { source: string }) {
  return (
    <article aria-label="Wiki preview" className="wiki-preview wiki-content">
      <Markdown
        skipHtml
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={{
          a: ({ children, href }) => (
            <a href={href} rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <img src={src} alt={alt ?? ""} loading="lazy" referrerPolicy="no-referrer" />
          ),
        }}
      >
        {source}
      </Markdown>
    </article>
  );
});
export default WikiPreview;
