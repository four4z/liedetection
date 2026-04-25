import Sidebar from "../component/Sidebar";

export default function HistoryLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <Sidebar>{children}</Sidebar>;
}
