import Sidebar from "../component/Sidebar";

export default function ListLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <Sidebar>{children}</Sidebar>;
}
