import eslint from "@eslint/js"
import tseslint from "typescript-eslint"

export default tseslint.config(
    { ignores: ["dist/**", "data/**", "coverage/**"] },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
        files: ["**/*.js"],
        extends: [tseslint.configs.disableTypeChecked],
    },
    {
        files: ["**/*.ts"],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "@typescript-eslint/consistent-type-imports": "error",
            "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
        },
    },
)
