import Icon from "@/components/ui/icon";
import type { Page } from "@/App";

interface Props {
  setPage: (p: Page) => void;
}

export default function OfertaSellerPage({ setPage }: Props) {
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
              Публичная оферта на оказание услуг маркетплейса
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Для продавцов (юридических лиц, ИП и самозанятых)</p>
          </div>

          <Section title="1. Общие положения">
            <p>
              1.1. Настоящий документ является предложением ИП Буцкого Дениса Алексеевича (далее — Маркетплейс) заключить договор с юридическими лицами, индивидуальными предпринимателями и самозанятыми (далее — Продавец) на оказание услуг по размещению товаров и организации расчетов.
            </p>
          </Section>

          <Section title="2. Порядок расчетов и комиссия">
            <p>
              2.1. Оплата за Товар осуществляется через сервис «Безопасная сделка» Банка-партнера (АО «ТБанк»).
            </p>
            <p>
              2.2. В момент оплаты сумма замораживается (холдируется) на счете Покупателя на срок 7 (семь) календарных дней.
            </p>
            <p>
              2.3. Если в течение 7 дней статус заказа не будет изменён Продавцом на «Отправлено» или «Доставлено», средства автоматически возвращаются Покупателю.
            </p>
            <p>
              2.4. Вознаграждение Маркетплейса составляет <strong>10% (десять процентов)</strong> от стоимости Товара.
            </p>
            <p>
              2.5. После подтверждения доставки Банк автоматически разделяет платёж: 90% направляется Продавцу, 10% — Маркетплейсу.
            </p>
          </Section>

          <Section title="3. Доставка и возвраты">
            <p>
              3.1. Первичная доставка до Покупателя оплачивается Покупателем.
            </p>
            <p>
              3.2. В случае возврата товара по причине брака или несоответствия описанию расходы на обратную доставку несёт Продавец.
            </p>
            <p>
              3.3. В случае обоснованного возврата после выплаты средств Продавец обязан вернуть деньги Покупателю в течение 7 (семи) календарных дней. Комиссия Маркетплейса (10%) возврату не подлежит.
            </p>
          </Section>

          <Section title="4. Реквизиты Маркетплейса">
            <div className="bg-secondary rounded-xl p-4 space-y-1.5 text-sm">
              <p className="font-semibold text-foreground">ИП Буцкий Денис Алексеевич</p>
              <p><span className="text-muted-foreground">ИНН:</span> 260803860085</p>
              <p><span className="text-muted-foreground">ОГРНИП:</span> 312265112300528</p>
              <p><span className="text-muted-foreground">Р/с:</span> 40802810960100016662</p>
              <p><span className="text-muted-foreground">БИК:</span> 040702615</p>
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
