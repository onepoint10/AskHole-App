import * as React from "react";
import { cn } from "@/lib/utils";

export function MarkdownTable({ children }) {
    return (
        <div className={cn(
            "my-4 w-full",
            "rounded-lg border border-border/50 overflow-hidden",
            "shadow-sm hover:shadow-md transition-shadow duration-200"
        )}>
            <div className="w-full overflow-x-auto overflow-y-visible scrollbar-thin scrollbar-thumb-muted/60 scrollbar-track-transparent">
                <table className="w-full border-collapse text-sm">
                    {children}
                </table>
            </div>
        </div>
    );
}

export function MarkdownTableHead({ children }) {
    return (
        <thead className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm bg-opacity-90">
            {children}
        </thead>
    );
}

export function MarkdownTableBody({ children }) {
    return (
        <tbody className="divide-y divide-border/50">
            {children}
        </tbody>
    );
}

export function MarkdownTableRow({ children }) {
    return (
        <tr className="transition-colors hover:bg-muted/30">
            {children}
        </tr>
    );
}

export function MarkdownTableHeader({ children }) {
    return (
        <th className={cn(
            "border-b border-border/50 text-left font-medium text-muted-foreground",
            "bg-muted/30 backdrop-blur-sm",
            "px-4 py-3 text-sm"
        )}>
            {children}
        </th>
    );
}

export function MarkdownTableCell({ children }) {
    return (
        <td className={cn(
            "text-foreground",
            "px-4 py-3 text-sm",
            "whitespace-normal break-words"
        )}>
            {children}
        </td>
    );
}

