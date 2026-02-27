import * as React from "react";
import { Input } from "./input";
import { cn } from "../../lib/utils";

interface InputFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
    onChange?: (value: string) => void;
}

export const InputField = React.memo(function InputField({ onChange, className, ...props }: InputFieldProps) {
    return (
        <Input
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            className={cn("w-full", className)}
            {...props}
        />
    );
});

interface SelectFieldProps {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string } | string>;
    className?: string;
    style?: React.CSSProperties;
}

export const SelectField = React.memo(function SelectField({ value, onChange, options, className, style }: SelectFieldProps) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={style}
            className={cn(
                "w-full px-3 py-2 text-[13px] rounded-[7px] cursor-pointer transition-all outline-none",
                "bg-[hsl(var(--input))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))]",
                className
            )}
        >
            {options.map((o) => {
                const val = typeof o === "string" ? o : o.value;
                const label = typeof o === "string" ? o : o.label;
                return <option key={val} value={val}>{label}</option>;
            })}
        </select>
    );
});
