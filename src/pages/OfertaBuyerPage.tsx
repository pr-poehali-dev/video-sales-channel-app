import Icon from "@/components/ui/icon";
import type { Page } from "@/App";

interface Props {
  setPage: (p: Page) => void;
}

export default function OfertaBuyerPage({ setPage }: Props) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
        <button
          onClick={() => setPage("home")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <Icon name="ArrowLeft" size={16} />
          На главную
        </button>

        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-foreground leading-tight">
              Пользовательское соглашение (оферта для покупателей)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Маркетплейс ИП Буцкий Д.А.</p>
          </div>

          <Section title="1. Безопасная сделка">
            <p>
              1.1. Маркетплейс (ИП Буцкий Д.А.) обеспечивает сохранность ваших средств через технологию холдирования Банка-партнёра (АО «ТБанк»).
            </p>
            <p>
              1.2. Деньги замораживаются на вашей карте и переводятся продавцу только после подтверждения получения товара. Максимальный срок заморозки — <strong>7 (семь) календарных дней</strong>.
            </p>
            <p>
              1.3. Если продавец не подтверждает отправку товара в течение 7 дней, средства автоматически размораживаются на вашей карте.
            </p>
          </Section>

          <Section title="2. Доставка и возврат">
            <p>
              2.1. Доставка товара оплачивается Покупателем. В случае выявления брака обратная доставка осуществляется за счёт Продавца.
            </p>
            <p>
              2.2. Если сделка завершена (деньги выплачены), Продавец обязан произвести возврат средств за брак или несоответствие товара в течение 7 (семи) календарных дней после вашего обращения.
            </p>
          </Section>

          <Section title="3. Товары б/у (бывшие в употреблении)">
            <p>
              3.1. На Маркетплейсе физические лица вправе продавать исключительно б/у товары. Такие товары отмечены пометкой <strong>«б/у»</strong> на карточке.
            </p>
            <p>
              3.2. Товары б/у продаются <strong>«как есть»</strong> — в том состоянии, которое описано продавцом. Маркетплейс не несёт ответственности за скрытые дефекты, износ, неполную комплектацию или иные недостатки, не отражённые в описании, если Покупатель мог ознакомиться с описанием до совершения покупки.
            </p>
            <p>
              3.3. На б/у товары от физических лиц <strong>не распространяется</strong> гарантия производителя и законодательно установленные гарантийные сроки, предусмотренные для новых товаров.
            </p>
            <p>
              3.4. Возврат б/у товара возможен только в случае существенного несоответствия товара описанию (например, указан «рабочий», а товар неработающий). Внешний вид, царапины и следы использования, соответствующие описанию, основанием для возврата не являются.
            </p>
            <p>
              3.5. Оплата б/у товара от физлица проводится в режиме <em>«перевод средств»</em> (C2C-сделка) через агентскую схему Маркетплейса. Кассовый чек в рамках таких операций не формируется; Покупатель подтверждает согласие с этим условием при оформлении заказа.
            </p>
          </Section>

          <Section title="4. Реквизиты">
            <div className="bg-secondary rounded-xl p-4 space-y-1.5 text-sm">
              <p className="font-semibold text-foreground">ИП Буцкий Денис Алексеевич</p>
              <p><span className="text-muted-foreground">ИНН:</span> 260803860085</p>
              <p><span className="text-muted-foreground">ОГРНИП:</span> 312265112300528</p>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </div>
  );
}