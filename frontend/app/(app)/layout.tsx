import Sidebar from "../component/Sidebar";

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <Sidebar>{children}</Sidebar>;
}