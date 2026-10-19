import {
  createContext,
  useContext,
  type ComponentProps,
  type ReactNode,
  type RefCallback,
} from "react";

const HeaderHostContext = createContext<RefCallback<HTMLElement> | undefined>(undefined);

/** Lets a host compose platform controls into the current application header. */
export function AppChromeProvider({
  headerRef,
  children,
}: {
  headerRef: RefCallback<HTMLElement>;
  children: ReactNode;
}) {
  return <HeaderHostContext value={headerRef}>{children}</HeaderHostContext>;
}

export function AppHeader(props: ComponentProps<"header">) {
  const ref = useContext(HeaderHostContext);
  return <header {...props} ref={ref} data-app-header="" />;
}
