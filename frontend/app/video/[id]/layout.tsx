import Sidebar from "../../component/Sidebar";

export default function VideoDetailLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <Sidebar>{children}</Sidebar>;
}