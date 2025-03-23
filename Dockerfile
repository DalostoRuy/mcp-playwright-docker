FROM mcr.microsoft.com/playwright:v1.52.0-alpha-2025-03-21-jammy

USER root

WORKDIR /app

# Copiar arquivos de configuração
COPY package*.json tsconfig.json ./

# Instalar dependências
RUN npm ci

# Copiar código-fonte
COPY . .

# Compilar TypeScript
RUN npm run build

# Limpar dependências de desenvolvimento
RUN npm prune --production

# Configurar usuário não-root para segurança
RUN groupadd -r mcpuser && \
    useradd -r -g mcpuser -G audio,video mcpuser && \
    mkdir -p /home/mcpuser/Downloads && \
    chown -R mcpuser:mcpuser /home/mcpuser && \
    chown -R mcpuser:mcpuser /app

# Configurar variáveis de ambiente
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV DOCKER_CONTAINER=true

# Entrypoint para o servidor MCP
ENTRYPOINT ["node", "cli.js"]

# Argumentos padrão (headless por padrão)
CMD ["--headless"]