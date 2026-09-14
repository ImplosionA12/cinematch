// Some networks refuse SRV lookups needed by mongodb+srv:// URIs; use public resolvers.
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
