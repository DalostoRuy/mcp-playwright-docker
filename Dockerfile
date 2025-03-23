FROM mcr.microsoft.com/playwright:v1.42.1-jammy

# Definir como usuário root para instalações
USER root
WORKDIR /app

# Copiar arquivos de configuração
COPY package*.json tsconfig.json ./

# Instalar a versão específica do Playwright mencionada no package.json
RUN npm ci

# Instalar explicitamente os navegadores necessários
RUN npx playwright install chrome
RUN npx playwright install chromium
RUN npx playwright install firefox

# Copiar código-fonte
COPY . .

# Compilar TypeScript
RUN npm run build

# Limpar dependências de desenvolvimento
RUN npm prune --production

# Adicionar permissões para os navegadores
RUN chmod -R 755 /ms-playwright/

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