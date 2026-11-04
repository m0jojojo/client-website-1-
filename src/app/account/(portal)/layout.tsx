import { AccountNav } from "@/components/account/AccountNav";

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <>
      <AccountNav />
      {children}
    </>
  );
}
