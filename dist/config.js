const config = {
    env: process.env.NODE_ENV || "development",
    debug: process.env.APP_DEBUG === "false",
    port: parseInt(process.env.PORT || "3000"),
    /**
     * Reads database connection settings from environment variables.
     *
     * @returns Database configuration object used by data clients.
     */
    getDatabaseConfig: () => ({
        database: process.env.DB_NAME,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || "3306"),
    }),
};
export default config;
//# sourceMappingURL=config.js.map