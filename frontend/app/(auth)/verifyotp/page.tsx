import VerifyOtpClient from "./VerifyOtpClient";

export const dynamic = "force-dynamic";

type VerifyOtpPageProps = {
    searchParams?: Record<string, string | string[] | undefined>;
};

const getSearchParam = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) {
        return value[0] || "";
    }
    return value || "";
};

export default function VerifyOtpPage({ searchParams = {} }: VerifyOtpPageProps) {
    const initialEmail = getSearchParam(searchParams.email);

    return <VerifyOtpClient initialEmail={initialEmail} />;
}