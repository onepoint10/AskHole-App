import * as React from "react";
import { cn } from "@/lib/utils";

export function MarkdownTable({ children, isMobile }) {
    return (
        <div className={cn(
            "my-4 w-full",
            "rounded-lg border border-border/50 overflow-hidden",
            "shadow-sm hover:shadow-md transition-shadow duration-200",
            isMobile ? "max-w-[calc(100vw-2rem)]" : "max-w-full"
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

export function MarkdownTableHeader({ children, isMobile }) {
    return (
        <th className={cn(
            "border-b border-border/50 text-left font-medium text-muted-foreground",
            "bg-muted/30 backdrop-blur-sm",
            isMobile ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
        )}>
            {children}
        </th>
    );
}

export function MarkdownTableCell({ children, isMobile }) {
    return (
        <td className={cn(
            "text-foreground",
            isMobile ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm",
            "whitespace-normal break-words"
        )}>
            {children}
        </td>
    );
}

export function MarkdownTableResponsive({ isMobile, headers, rows }) {
    if (!isMobile) {
        return (
            <MarkdownTable isMobile={false}>
                <MarkdownTableHead>
                    <MarkdownTableRow>
                        {headers.map((header, i) => (
                            <MarkdownTableHeader key={i} isMobile={false}>{header}</MarkdownTableHeader>
                        ))}
                    </MarkdownTableRow>
                </MarkdownTableHead>
                <MarkdownTableBody>
                    {rows.map((row, i) => (
                        <MarkdownTableRow key={i}>
                            {row.map((cell, j) => (
                                <MarkdownTableCell key={j} isMobile={false}>{cell}</MarkdownTableCell>
                            ))}
                        </MarkdownTableRow>
                    ))}
                </MarkdownTableBody>
            </MarkdownTable>
        );
    }

    // Mobile card view for tables
    return (
        <div className="space-y-4">
            {rows.map((row, i) => (
                <div key={i} className="p-4 rounded-lg border border-border/50 space-y-2 bg-background/50">
                    {row.map((cell, j) => headers[j] && (
                        <div key={j} className="flex flex-col space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">
                                {headers[j]}
                            </span>
                            <span className="text-sm">{cell}</span>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}