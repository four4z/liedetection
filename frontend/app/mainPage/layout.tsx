import Sidebar from "../component/Sidebar";

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <Sidebar>{children}</Sidebar>;
}
