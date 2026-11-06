# Finanças G&L

Controle de entradas, gastos fixos, parcelas e projeção de saldo para duas pessoas. Cada uma tem as próprias finanças, e as duas têm uma área conjunta. Funciona no computador e no celular, inclusive sem internet.

Não depende de nenhum serviço de IA. São arquivos estáticos em um site gratuito, e os dados ficam em uma planilha Google.

## Como as áreas funcionam

- Cada aparelho fica no perfil de uma pessoa e abre direto nas finanças dela.
- O botão **Minhas / Conjunta** troca de área. A área conjunta usa outra cor, para se ver de relance onde se está.
- Cada área tem as próprias contas, categorias, limites, fixos e metas. Nada se soma nem se mistura entre elas.
- Os lançamentos que existiam antes dos perfis pertencem à primeira pessoa.
- Para trocar a pessoa de um aparelho, use **Ajustes > Trocar de pessoa**.

A separação é de organização, não de segurança. As três áreas ficam na mesma planilha, com a mesma chave. O backup em arquivo também inclui as três.

## Exportar em PDF

- **Lançamentos > Exportar este mês em PDF:** resumo e lista do mês aberto, respeitando o filtro aplicado na tela.
- **Gráficos > Exportar gráficos em PDF:** entradas × saídas, saldo, categorias do mês e valores mês a mês.

O PDF é gerado no próprio aparelho, com a biblioteca [jsPDF](https://github.com/parallax/jsPDF) (licença MIT), guardada em `vendor/`.

## Como os dados são guardados

- Cada aparelho guarda uma cópia local e funciona sozinho.
- Com a planilha conectada, os aparelhos trocam só as diferenças. Se o mesmo registro for editado em dois lugares, a edição mais recente vence.
- O código do site é público no GitHub Pages, mas não contém nenhum dado seu.
- A planilha só responde a quem tem a chave de acesso, que fica salva no navegador de cada aparelho conectado.

## Passo 1: colocar o site no ar (GitHub Pages)

1. Crie um repositório público em <https://github.com/new>, com o nome `livro-caixa`.
2. Envie os arquivos desta pasta para o repositório.
3. Em **Settings > Pages**, escolha **Deploy from a branch**, a branch `main` e a pasta `/ (root)`. Salve.
4. Em cerca de um minuto, o site estará em `https://SEU-USUARIO.github.io/livro-caixa/`.

## Passo 2: criar a planilha

1. Crie uma planilha em branco em <https://sheets.new>.
2. Abra **Extensões > Apps Script**.
3. Apague o conteúdo do editor, cole o arquivo [`apps-script/Codigo.gs`](apps-script/Codigo.gs) e salve.
4. Na barra superior, escolha a função `configurar` e clique em **Executar**. Autorize o acesso à sua própria planilha.
5. Copie a **chave de acesso** que aparece no Registro de execução.
6. Clique em **Implantar > Nova implantação**, escolha o tipo **App da Web** e use:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
7. Copie a URL que termina em `/exec`.

"Qualquer pessoa" apenas libera o endereço para o app conseguir chamá-lo. Sem a chave, o script não lê nem grava nada.

## Passo 3: conectar os aparelhos

No primeiro aparelho, abra **Ajustes > Sincronização**, cole a URL e a chave e clique em **Conectar**. Informe os nomes das duas pessoas quando o app pedir.

Nos demais, inclusive os da outra pessoa, abra o site, escolha **Já uso em outro aparelho**, informe os mesmos dados e diga quem usa aquele aparelho.

Para instalar no celular:

- **Android (Chrome):** menu de três pontos > **Instalar app**.
- **iPhone (Safari):** botão Compartilhar > **Adicionar à Tela de Início**.

## Como o app calcula

- **Saldo hoje:** saldo inicial das contas mais o que já foi pago ou recebido.
- **Cartão:** a compra aparece no mês em que foi feita, mas só sai do saldo no vencimento da fatura. Compras no dia do fechamento ou depois vão para a fatura seguinte.
- **Fixos:** aparecem todo mês como previstos até serem confirmados. Fixos no cartão são confirmados sozinhos quando a data chega.
- **Gastos variáveis estimados:** média dos últimos 3 meses completos, sem contar fixos, parcelas e gastos planejados. Dá para definir o valor à mão em **Planejar**.
- **Entradas prováveis:** ficam fora da projeção conservadora e aparecem em uma linha separada no gráfico.

## Se a chave vazar

No Apps Script, rode a função `trocarChave`. Depois desconecte e conecte de novo cada aparelho com a chave nova.

## Atualizar o script da planilha

Depois de editar o script, use **Implantar > Gerenciar implantações > Editar > Nova versão**, para manter a mesma URL.

## Testes

```bash
node --test testes/logica.test.js testes/sincronia.test.js
```

Para abrir no computador sem publicar:

```bash
python -m http.server 8765
```
