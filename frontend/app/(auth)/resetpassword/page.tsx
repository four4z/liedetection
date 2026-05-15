import ResetPasswordClient from "./ResetPasswordClient";

export const dynamic = "force-dynamic";

type ResetPasswordPageProps = {
    searchParams?: Record<string, string | string[] | undefined>;
};

const getSearchParam = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) {
        return value[0] || "";
    }
    return value || "";
};

export default function ResetPasswordPage({ searchParams = {} }: ResetPasswordPageProps) {
    const token = getSearchParam(searchParams.token);
    const email = getSearchParam(searchParams.email);


    return <ResetPasswordClient token={token} email={email} />;
}