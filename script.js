/*
  Stamp 2 Pay Check - script
  All the calculations run in the browser. Nothing is saved or sent.
*/

/* =====================================================================
   1. RULES
   The rules are kept here as data, separate from the calculations.
   Each minimum wage rule has a start and end date, because the rate
   changes every January. To update the site we only edit this section.
   Sources: WRC (minimum wage) and ISD (Stamp 2 hours).
   Last checked: 13 November 2026.
   ===================================================================== */

var MINIMUM_WAGE_RULES = [
  {
    from: "2026-01-01",
    to:   "2026-12-31",
    rates: { adult: 14.15, age19: 12.74, age18: 11.32, under18: 9.91 }
  },
  {
    // National Minimum Wage Order 2026 (S.I. No. 533 of 2026),
    // in force from 1 January 2027. The rates for under 20s are
    // 90%, 80% and 70% of the adult rate.
    from: "2027-01-01",
    to:   "2027-12-31",
    rates: { adult: 14.94, age19: 13.45, age18: 11.95, under18: 10.46 }
  }
];

// Stamp 2 weekly limits
var HOURS_TERM_TIME = 20;
var HOURS_HOLIDAYS = 40;

// PRSI: an employee who earns this amount or less in a week does not pay
// employee PRSI. For fortnightly and monthly pay we use the same amount
// for the length of the period (352 x 2, and 352 x 52 / 12 for a month).
// Source: Revenue and KPMG Budget 2027 tables, checked 13/11/2026.
var PRSI_WEEKLY_THRESHOLD = 352;

// MyFutureFund automatic enrolment: at least 23 and under 60, and pay of
// €20,000 or more a year in all jobs, or €5,000 or more in 13 weeks. People who do not
// meet this can choose to join (opt in). Source: myfuturefund.ie and
// payroll guides, checked 13/11/2026.
var MFF_YEARLY_THRESHOLD = 20000;
var MFF_13_WEEK_THRESHOLD = 5000;

// MyFutureFund (auto-enrolment pension), started on 1 January 2026.
// The rates are a part of the gross pay and go up every 3 years.
// The employee does not get tax relief: the State top-up replaces it.
// Source: Department of Social Protection.
var MY_FUTURE_FUND_RULES = [
  { from: "2026-01-01", to: "2028-12-31", employee: 0.015, employer: 0.015, state: 0.005 },
  { from: "2029-01-01", to: "2031-12-31", employee: 0.03,  employer: 0.03,  state: 0.01 },
  { from: "2032-01-01", to: "2034-12-31", employee: 0.045, employer: 0.045, state: 0.015 }
];

// Extra payments that can appear on a payslip.
// "countsForMinimumWage" follows Schedule 1 of the National Minimum Wage
// Act 2000: only basic pay, shift premium and productivity bonuses or
// commission count. Premiums, tips, holiday pay, sick pay and expenses
// do not. The name and explanation of each type are in TEXTS
// ("pay_" + id and "pay_" + id + "_text").
// To keep the page simple we only list the payments that are common on
// the payslips of students in hospitality. Night premium, public holiday,
// sick pay and expenses can be entered as "other" (roadmap: own types).
var EXTRA_PAYMENT_TYPES = [
  { id: "sunday",     countsForMinimumWage: false },
  { id: "overtime",   countsForMinimumWage: false },
  { id: "holiday",    countsForMinimumWage: false },
  { id: "tips",       countsForMinimumWage: false },
  { id: "shiftBonus", countsForMinimumWage: true },
  { id: "other",      countsForMinimumWage: false }
];

// Extra deductions that can appear on a payslip.
// Texts are "ded_" + id and "ded_" + id + "_text".
// Only the deduction that is common for students in hospitality, plus
// "other". Union, health insurance, other pension, LPT and advances are
// rare for Stamp 2 students (roadmap: own types).
var EXTRA_DEDUCTION_TYPES = ["goods", "other"];

// Number of days in each pay period.
// "monthly" has no fixed number: it goes from the first day
// to the day before the same date in the next month.
var PERIOD_DAYS = { weekly: 7, fortnightly: 14 };


/* =====================================================================
   2. TEXTS IN EACH LANGUAGE
   Every text on the page has a key. The function t() returns the text
   in the language that is selected.
   ===================================================================== */

var TEXTS = {
  en: {
    locale: "en-IE",
    title: "Stamp 2 Pay Check",
    subtitle: "Check your pay in Ireland, weekly, fortnightly or monthly: minimum wage, payslip deductions and Stamp 2 hours.",
    privacy: "Your numbers stay on this device. This page does not save or send them.",
    formTitle: "Your pay period",
    ageLabel: "Your age",
    ageAdult: "20 or over",
    age19: "19",
    age18: "18",
    ageUnder18: "Under 18",
    periodLabel: "How often are you paid?",
    periodHint: "Look at the dates on your payslip.",
    periodWeekly: "Weekly (7 days)",
    periodFortnightly: "Fortnightly (14 days)",
    periodMonthly: "Monthly",
    dateLabel: "First day of the pay period",
    dateHint: "The minimum wage and the Stamp 2 limit depend on the date. For monthly pay this is usually the 1st of the month.",
    periodInfo: "Period: {from} to {to} ({days} days).",
    modeLabel: "How do you want to enter your hours and pay?",
    modeTotal: "Total for the period",
    modeDaily: "Day by day",
    hoursLabel: "Hours worked in the period",
    hoursHint: "Add the hours of all your jobs. Do not count unpaid breaks.",
    grossLabel: "Pay for the hours worked (€)",
    grossHint: "Hours × your normal rate, before tax. On the payslip it is usually “Basic Hours” or “Basic Pay”. Extras such as Sunday premium or holiday pay go in “Other payments” below.",
    dailyHint: "Enter the hours and the pay at your normal rate of each day you worked. Leave your days off empty. Do not count unpaid breaks. Extras go in “Other payments” below.",
    dailyNeedDate: "Choose the first day of the pay period to see the days.",
    colDay: "Day",
    colHours: "Hours",
    colPay: "Pay (€)",
    weekHeading: "Week {n}",
    dailyTotals: "Total: {hours} hours and {gross} pay.",
    ariaHours: "Hours on {day}",
    ariaPay: "Pay on {day}",
    detailsToggle: "Other payments and deductions (optional)",
    detailsHint: "Extra payments such as Sunday premium, overtime or tips, and other deductions such as uniforms or meals.",
    extraPayTitle: "Other payments",
    extraPayHint: "Other lines in the payments part of your payslip, such as Sunday premium, holiday pay or tips. For overtime and premiums, enter only the extra part above your normal rate.",
    extraDedTitle: "Other deductions",
    extraDedHint: "Any other line in the deductions part of your payslip.",
    addPayment: "Add a payment",
    addDeduction: "Add a deduction",
    removeButton: "Remove",
    ariaType: "Type of item {n}",
    ariaAmount: "Amount of item {n} (€)",
    pay_sunday: "Sunday premium",
    pay_sunday_text: "The Organisation of Working Time Act 1997 says Sunday work must be compensated: with an extra payment, a higher rate, paid time off, or a pay rate that already includes Sunday work. The law does not fix the amount.",
    pay_overtime: "Overtime (extra part only)",
    pay_overtime_text: "The law does not set a higher rate for overtime. It depends on your contract or on the rules for your sector. The extra part above your normal rate does not count for the minimum wage.",
    pay_shiftBonus: "Shift premium or productivity bonus",
    pay_shiftBonus_text: "Extra pay for working in shifts, and commission or bonuses linked to your productivity. These are the few extras that count for the minimum wage.",
    pay_holiday: "Holiday pay (annual leave)",
    pay_holiday_text: "You earn paid annual leave while you work, usually 8% of the hours worked, up to 4 working weeks per leave year. It is paid at your normal rate. Do not add the leave hours to the hours worked.",
    pay_tips: "Tips paid through payroll",
    pay_tips_text: "Under the Tips and Gratuities Act 2022 the employer cannot use tips to make up your pay and must show how tips are shared.",
    pay_other: "Other payment",
    pay_other_text: "We do not count it for the minimum wage. If it is a shift premium or a productivity bonus, choose that type instead.",
    countsYes: "Counts for the minimum wage.",
    countsNo: "Does not count for the minimum wage.",
    ded_goods: "Uniform, equipment or meals",
    ded_goods_text: "A deduction for goods, services or a mistake you made must be in your contract, be fair and reasonable, and be explained to you in writing at least one week before.",
    ded_other: "Other deduction",
    ded_other_text: "Ask your employer what this deduction is for.",
    dedLaw: "The Payment of Wages Act 1991 allows a deduction only if the law requires it (such as PAYE, USC, PRSI or MyFutureFund), if it is in your contract, or if you agreed to it in writing before it was made.",
    deductionsTitle: "Deductions on your payslip (optional)",
    deductionsHint: "Copy the amounts for the whole period from your payslip to see what each one means.",
    checkButton: "Check my pay",
    clearButton: "Clear",
    errorDate: "Choose the first day of the pay period.",
    errorHours: "Enter the hours you worked (more than 0).",
    errorGross: "Enter the pay for the hours you worked.",
    errorDailyHours: "Enter the hours of at least one day you worked.",
    errorDailyGross: "Enter the gross pay of the days you worked.",
    errorNegative: "Hours and pay cannot be negative. Check the numbers.",
    errorDeductions: "The deductions are bigger than the gross pay. Check the numbers.",
    errorNoRule: "We do not have the minimum wage for every day of this period. This prototype covers 2026 and 2027.",
    resultsTitle: "Your results",
    resultsPeriod: "Pay period: {from} to {to} ({days} days). Total: {hours} hours and {gross} gross pay.",
    wageCounted: "For the minimum wage we counted {counted} of your total gross pay of {total}. By law, some extras do not count (see “Other payments”).",
    extraTitle: "Other payments",
    extraSummary: "Total other payments: {total}. With the pay for your hours ({basic}), your gross pay is {gross}.",
    wageTitle: "Minimum wage",
    wageOk: "OK. Your pay reaches the minimum wage.",
    wageLow: "Check this. Your pay is below the minimum wage.",
    wageDetail: "You were paid {paid} per hour. The minimum for your age in this period is {min} per hour.",
    wageShort: "For {hours} hours you should receive at least {required}. The difference is {diff}.",
    wageRateChangeDaily: "The minimum wage changes during this period. Each day was checked with its own rate.",
    wageRateChangeTotal: "The minimum wage changes during this period, so this result is an estimate. Choose “Day by day” for an exact check.",
    hoursTitle: "Stamp 2 hours",
    hoursOk: "OK. {hours} hours is inside the limit of {limit} hours for this week.",
    hoursOver: "Check this. {hours} hours is over the limit of {limit} hours for this week.",
    hoursAvgOk: "OK. You worked {hours} hours in {days} days. That is an average of {avg} hours per week, inside the limit of {limit} hours per week.",
    hoursAvgOver: "Check this. You worked {hours} hours in {days} days. That is an average of {avg} hours per week, over the limit of {limit} hours per week.",
    hoursAvgNote: "A total does not show each week. Even when the average is inside the limit, one week can be over it. Choose “Day by day” to check every week.",
    hoursWeeksOk: "OK. Every week of this period is inside the Stamp 2 limit.",
    hoursWeeksOver: "Check this. Weeks over the Stamp 2 limit in this period: {count} of {total}.",
    weekLine: "Week {n} ({from} to {to}): {hours} hours. Limit: {limit} hours. {status}",
    weekOk: "OK.",
    weekOver: "Over the limit.",
    weekPartial: "Only {days} days of this week are in the period.",
    hoursTerm: "This period is in term time, so the limit is 20 hours per week.",
    hoursHoliday: "This period is in a holiday period (1 June to 30 September, or 15 December to 15 January), so the limit is 40 hours per week.",
    hoursMixed: "This period has weeks in term time (limit 20 hours) and weeks in a holiday period (limit 40 hours). A week only gets the 40-hour limit when every day of it is in a holiday period.",
    hoursPartWeek: "Part of a week is in a holiday period and part is in term time. To be safe, we use the 20-hour limit for that week. If you are not sure, ask Immigration Service Delivery (ISD).",
    hoursWarning: "Working over the limit can put your immigration permission at risk. This page does not save or share this information.",
    dedTitle: "Your deductions",
    dedSummary: "Total deductions: {total}. Estimated net pay: {net}.",
    dedOf: "{amount} ({percent}% of your gross pay)",
    payeText: "PAYE is income tax. Your employer takes it from your pay and sends it to Revenue. Tax credits reduce it, so on low pay it is often small or zero.",
    uscText: "USC (Universal Social Charge) is another tax on your gross pay. If your total income for the year is €13,000 or less, you do not pay it. Revenue tells your employer if you are exempt, so if you expect to earn €13,000 or less and USC is being taken, contact Revenue.",
    prsiText: "PRSI is social insurance. It pays for benefits such as illness benefit. If you earn €352 or less in a week, you do not pay employee PRSI. For this pay period that is about {limit} or less.",
    prsiCheck: "Check this. Your gross pay is {limit} or less for this period, but PRSI was taken. Normally no employee PRSI is due. Ask your employer or check myAccount on revenue.ie.",
    emergencyTax: "Check this. Your PAYE is more than 20% of your gross pay. This can be emergency tax, which happens when the job is not registered with Revenue. Log in to myAccount on revenue.ie to check.",
    mffText: "MyFutureFund (on the payslip it can be “MyFuture Fund EE”) is the State pension savings scheme, also called auto-enrolment. It is not a tax: the money goes into a pension account in your name. You pay {employee}% of your gross pay, your employer adds {employer}% and the State adds {state}%.",
    mffMatch: "This is the right amount: {employee}% of {gross} is {expected}.",
    mffSaved: "In this period your employer adds about {employer} and the State about {state}. In total, about {total} goes into your pension account.",
    mffEligibility: "You are put in the scheme automatically if you are 23 or over and under 60, and earn €20,000 or more a year in all your jobs, or €5,000 or more in 13 weeks. Working 40 hours a week in the summer can pass the 13-week amount. If you are under 23 or earn less, you are only in it if you chose to join. You can ask to leave (opt out) on myfuturefund.ie.",
    mffDifferent: "Check this. {employee}% of {gross} is {expected}, but you entered {paid}. Small differences can happen if your gross pay includes other taxable items. If the difference is big, ask your employer’s payroll team.",
    contactTitle: "Who to contact",
    contactWrc: "Workplace Relations Commission (WRC): for pay below the minimum wage, holidays and breaks. You can ask for information or make a complaint.",
    contactRevenue: "Revenue: for questions about tax, USC and emergency tax. Use myAccount on revenue.ie.",
    contactImmigration: "Immigration Service Delivery (ISD): for the official Stamp 2 work conditions.",
    contactCitizens: "Citizens Information: free and confidential advice about work rights in simple language.",
    contactPayroll: "Your employer’s payroll team: for questions about the MyFutureFund amount on your payslip.",
    contactMff: "MyFutureFund (myfuturefund.ie): for questions about joining, leaving (opt out) or your pension account. Your employer cannot decide this for you.",
    contactWrcDeductions: "Workplace Relations Commission (WRC): if a deduction was made without your agreement or without a reason in the law or your contract.",
    disclaimer: "This is a student prototype. It gives general information, not legal or tax advice. Always confirm with the official sources.",
    sources: "Official sources (rules last checked on 13 November 2026):",
    credits: "Student project for Project Skills & Professionalism, CCT College Dublin."
  },

  pt: {
    locale: "pt-BR",
    title: "Stamp 2 Pay Check",
    subtitle: "Confira seu pagamento na Irlanda, semanal, quinzenal ou mensal: salário mínimo, descontos do payslip e horas do Stamp 2.",
    privacy: "Seus números ficam neste aparelho. Esta página não salva nem envia nada.",
    formTitle: "Seu período de pagamento",
    ageLabel: "Sua idade",
    ageAdult: "20 ou mais",
    age19: "19",
    age18: "18",
    ageUnder18: "Menos de 18",
    periodLabel: "Com que frequência você recebe?",
    periodHint: "Veja as datas no seu payslip.",
    periodWeekly: "Semanal (7 dias)",
    periodFortnightly: "Quinzenal (14 dias)",
    periodMonthly: "Mensal",
    dateLabel: "Primeiro dia do período de pagamento",
    dateHint: "O salário mínimo e o limite do Stamp 2 dependem da data. No pagamento mensal costuma ser o dia 1º do mês.",
    periodInfo: "Período: {from} a {to} ({days} dias).",
    modeLabel: "Como você quer lançar as horas e o pagamento?",
    modeTotal: "Total do período",
    modeDaily: "Dia a dia",
    hoursLabel: "Horas trabalhadas no período",
    hoursHint: "Some as horas de todos os seus empregos. Não conte pausas não pagas.",
    grossLabel: "Pagamento das horas trabalhadas (€)",
    grossHint: "Horas × sua taxa normal, antes dos impostos. No payslip costuma aparecer como “Basic Hours” ou “Basic Pay”. Extras como adicional de domingo ou férias vão em “Outros pagamentos”, mais abaixo.",
    dailyHint: "Informe as horas e o pagamento pela taxa normal de cada dia trabalhado. Deixe em branco os dias de folga. Não conte pausas não pagas. Extras vão em “Outros pagamentos”, mais abaixo.",
    dailyNeedDate: "Escolha o primeiro dia do período para ver os dias.",
    colDay: "Dia",
    colHours: "Horas",
    colPay: "Pagamento (€)",
    weekHeading: "Semana {n}",
    dailyTotals: "Total: {hours} horas e {gross} de pagamento.",
    ariaHours: "Horas em {day}",
    ariaPay: "Pagamento em {day}",
    detailsToggle: "Outros pagamentos e descontos (opcional)",
    detailsHint: "Pagamentos extras, como adicional de domingo, hora extra ou gorjetas, e outros descontos, como uniforme ou refeições.",
    extraPayTitle: "Outros pagamentos",
    extraPayHint: "Outras linhas da parte de pagamentos do payslip, como adicional de domingo, férias ou gorjetas. Para horas extras e adicionais, informe só o valor a mais, acima da sua taxa normal.",
    extraDedTitle: "Outros descontos",
    extraDedHint: "Qualquer outra linha da parte de descontos do payslip.",
    addPayment: "Adicionar pagamento",
    addDeduction: "Adicionar desconto",
    removeButton: "Remover",
    ariaType: "Tipo do item {n}",
    ariaAmount: "Valor do item {n} (€)",
    pay_sunday: "Adicional de domingo (Sunday premium)",
    pay_sunday_text: "A Organisation of Working Time Act 1997 diz que o trabalho no domingo deve ser compensado: com um pagamento extra, uma taxa maior, folga paga, ou uma taxa que já inclui o domingo. A lei não fixa o valor.",
    pay_overtime: "Horas extras (só o valor a mais)",
    pay_overtime_text: "A lei não define uma taxa maior para horas extras. Depende do contrato ou das regras do setor. A parte acima da sua taxa normal não conta para o salário mínimo.",
    pay_shiftBonus: "Adicional de turno ou bônus de produtividade",
    pay_shiftBonus_text: "Pagamento extra por trabalhar em turnos, e comissão ou bônus ligados à sua produtividade. São os poucos extras que contam para o salário mínimo.",
    pay_holiday: "Férias (holiday pay)",
    pay_holiday_text: "Você acumula férias pagas enquanto trabalha, normalmente 8% das horas trabalhadas, até 4 semanas de trabalho por ano de férias. São pagas pela sua taxa normal. Não some as horas de férias às horas trabalhadas.",
    pay_tips: "Gorjetas pagas pelo payroll",
    pay_tips_text: "Pela Tips and Gratuities Act 2022, o empregador não pode usar gorjetas para completar o seu pagamento e deve mostrar como as gorjetas são divididas.",
    pay_other: "Outro pagamento",
    pay_other_text: "Não contamos este valor para o salário mínimo. Se for adicional de turno ou bônus de produtividade, escolha esse tipo.",
    countsYes: "Conta para o salário mínimo.",
    countsNo: "Não conta para o salário mínimo.",
    ded_goods: "Uniforme, equipamento ou refeições",
    ded_goods_text: "Um desconto por produtos, serviços ou um erro seu precisa estar no contrato, ser justo e razoável, e ser explicado por escrito pelo menos uma semana antes.",
    ded_other: "Outro desconto",
    ded_other_text: "Pergunte ao empregador para que serve este desconto.",
    dedLaw: "A Payment of Wages Act 1991 só permite um desconto se a lei exige (como PAYE, USC, PRSI ou MyFutureFund), se está no seu contrato, ou se você concordou por escrito antes do desconto.",
    deductionsTitle: "Descontos do seu payslip (opcional)",
    deductionsHint: "Copie do payslip os valores do período inteiro para ver o que cada um significa.",
    checkButton: "Conferir meu pagamento",
    clearButton: "Limpar",
    errorDate: "Escolha o primeiro dia do período de pagamento.",
    errorHours: "Informe as horas trabalhadas (mais que 0).",
    errorGross: "Informe o pagamento das horas trabalhadas.",
    errorDailyHours: "Informe as horas de pelo menos um dia trabalhado.",
    errorDailyGross: "Informe o pagamento bruto dos dias trabalhados.",
    errorNegative: "Horas e pagamento não podem ser negativos. Confira os números.",
    errorDeductions: "Os descontos são maiores que o pagamento bruto. Confira os números.",
    errorNoRule: "Não temos o salário mínimo para todos os dias deste período. Este protótipo cobre 2026 e 2027.",
    resultsTitle: "Seus resultados",
    resultsPeriod: "Período: {from} a {to} ({days} dias). Total: {hours} horas e {gross} de pagamento bruto.",
    wageCounted: "Para o salário mínimo contamos {counted} do seu pagamento bruto total de {total}. Pela lei, alguns extras não contam (veja “Outros pagamentos”).",
    extraTitle: "Outros pagamentos",
    extraSummary: "Total de outros pagamentos: {total}. Com o pagamento das horas ({basic}), seu pagamento bruto é {gross}.",
    wageTitle: "Salário mínimo",
    wageOk: "OK. Seu pagamento atinge o salário mínimo.",
    wageLow: "Atenção. Seu pagamento está abaixo do salário mínimo.",
    wageDetail: "Você recebeu {paid} por hora. O mínimo para a sua idade neste período é {min} por hora.",
    wageShort: "Por {hours} horas você deveria receber pelo menos {required}. A diferença é de {diff}.",
    wageRateChangeDaily: "O salário mínimo muda durante este período. Cada dia foi conferido com o seu próprio valor.",
    wageRateChangeTotal: "O salário mínimo muda durante este período, então este resultado é uma estimativa. Escolha “Dia a dia” para uma conferência exata.",
    hoursTitle: "Horas do Stamp 2",
    hoursOk: "OK. {hours} horas está dentro do limite de {limit} horas para esta semana.",
    hoursOver: "Atenção. {hours} horas passa do limite de {limit} horas para esta semana.",
    hoursAvgOk: "OK. Você trabalhou {hours} horas em {days} dias. Isso dá uma média de {avg} horas por semana, dentro do limite de {limit} horas por semana.",
    hoursAvgOver: "Atenção. Você trabalhou {hours} horas em {days} dias. Isso dá uma média de {avg} horas por semana, acima do limite de {limit} horas por semana.",
    hoursAvgNote: "O total não mostra cada semana. Mesmo com a média dentro do limite, uma semana pode ter passado. Escolha “Dia a dia” para conferir semana por semana.",
    hoursWeeksOk: "OK. Todas as semanas deste período estão dentro do limite do Stamp 2.",
    hoursWeeksOver: "Atenção. Semanas acima do limite do Stamp 2 neste período: {count} de {total}.",
    weekLine: "Semana {n} ({from} a {to}): {hours} horas. Limite: {limit} horas. {status}",
    weekOk: "OK.",
    weekOver: "Acima do limite.",
    weekPartial: "Só {days} dias desta semana estão no período.",
    hoursTerm: "Este período está no período de aulas, então o limite é de 20 horas por semana.",
    hoursHoliday: "Este período está nas férias (1 de junho a 30 de setembro, ou 15 de dezembro a 15 de janeiro), então o limite é de 40 horas por semana.",
    hoursMixed: "Este período tem semanas de aulas (limite de 20 horas) e semanas de férias (limite de 40 horas). Uma semana só tem o limite de 40 horas quando todos os dias dela estão em período de férias.",
    hoursPartWeek: "Uma parte da semana está nas férias e outra no período de aulas. Por segurança, usamos o limite de 20 horas para essa semana. Em caso de dúvida, consulte a Immigration Service Delivery (ISD).",
    hoursWarning: "Trabalhar acima do limite pode colocar sua permissão de imigração em risco. Esta página não salva nem compartilha essa informação.",
    dedTitle: "Seus descontos",
    dedSummary: "Total de descontos: {total}. Pagamento líquido estimado: {net}.",
    dedOf: "{amount} ({percent}% do seu pagamento bruto)",
    payeText: "PAYE é o imposto de renda. O empregador desconta do seu pagamento e envia para a Revenue. Os créditos fiscais reduzem o valor, então em pagamentos baixos ele costuma ser pequeno ou zero.",
    uscText: "USC (Universal Social Charge) é outro imposto sobre o pagamento bruto. Se a sua renda total no ano for de €13.000 ou menos, você não paga. A Revenue avisa o empregador quando você está isento, então se você espera ganhar €13.000 ou menos e o USC está sendo descontado, fale com a Revenue.",
    prsiText: "PRSI é a contribuição social. Ela financia benefícios como o auxílio-doença. Quem ganha €352 ou menos numa semana não paga o PRSI do empregado. Para este período, isso dá cerca de {limit} ou menos.",
    prsiCheck: "Atenção. Seu pagamento bruto é de {limit} ou menos neste período, mas houve desconto de PRSI. Normalmente não há PRSI do empregado. Pergunte ao empregador ou confira no myAccount em revenue.ie.",
    emergencyTax: "Atenção. Seu PAYE é mais de 20% do pagamento bruto. Pode ser emergency tax, que acontece quando o emprego não está registrado na Revenue. Entre no myAccount em revenue.ie para conferir.",
    mffText: "MyFutureFund (no payslip pode aparecer como “MyFuture Fund EE”) é o plano de aposentadoria do governo, também chamado de auto-enrolment. Não é imposto: o dinheiro vai para uma conta de aposentadoria no seu nome. Você paga {employee}% do pagamento bruto, o empregador coloca mais {employer}% e o Estado mais {state}%.",
    mffMatch: "O valor está certo: {employee}% de {gross} é {expected}.",
    mffSaved: "Neste período o empregador coloca cerca de {employer} e o Estado cerca de {state}. No total, cerca de {total} vai para a sua conta de aposentadoria.",
    mffEligibility: "Você entra automaticamente se tiver 23 anos ou mais e menos de 60, e ganhar €20.000 ou mais por ano somando todos os empregos, ou €5.000 ou mais em 13 semanas. Trabalhar 40 horas por semana no verão pode passar desse valor de 13 semanas. Se você tem menos de 23 anos ou ganha menos, só participa se escolheu entrar. Você pode pedir para sair (opt out) em myfuturefund.ie.",
    mffDifferent: "Atenção. {employee}% de {gross} é {expected}, mas você informou {paid}. Pequenas diferenças podem acontecer se o pagamento bruto inclui outros valores tributáveis. Se a diferença for grande, pergunte ao setor de folha de pagamento (payroll) do empregador.",
    contactTitle: "Quem procurar",
    contactWrc: "Workplace Relations Commission (WRC): para pagamento abaixo do mínimo, férias e pausas. Você pode pedir informação ou fazer uma reclamação.",
    contactRevenue: "Revenue: para dúvidas sobre imposto, USC e emergency tax. Use o myAccount em revenue.ie.",
    contactImmigration: "Immigration Service Delivery (ISD): para as condições oficiais de trabalho do Stamp 2.",
    contactCitizens: "Citizens Information: orientação gratuita e confidencial sobre direitos trabalhistas em linguagem simples.",
    contactPayroll: "Setor de folha de pagamento (payroll) do empregador: para dúvidas sobre o valor do MyFutureFund no payslip.",
    contactMff: "MyFutureFund (myfuturefund.ie): para dúvidas sobre entrar, sair (opt out) ou sobre a sua conta de aposentadoria. O empregador não pode decidir isso por você.",
    contactWrcDeductions: "Workplace Relations Commission (WRC): se um desconto foi feito sem o seu acordo ou sem motivo na lei ou no contrato.",
    disclaimer: "Este é um protótipo de estudantes. Ele dá informação geral, não aconselhamento jurídico ou fiscal. Sempre confirme nas fontes oficiais.",
    sources: "Fontes oficiais (regras conferidas em 13 de novembro de 2026):",
    credits: "Projeto de estudantes para Project Skills & Professionalism, CCT College Dublin."
  }
};

var currentLanguage = "en";

// Keeps the last calculation so we can show it again if the language changes
var lastResult = null;

// Keeps what the user typed for each day, for example
// dayValues["2026-11-03"] = { hours: "6", pay: "84.90" }.
// It is only a variable in memory: it disappears when the page closes.
var dayValues = {};

// The other payments and deductions typed by the user.
// Each item is { type: "sunday", amount: "12.50" }.
var extraItems = { payment: [], deduction: [] };

// Returns a text in the current language.
// "values" is optional and replaces {name} placeholders inside the text.
function t(key, values) {
  var text = TEXTS[currentLanguage][key];
  if (values) {
    for (var name in values) {
      text = text.replace("{" + name + "}", values[name]);
    }
  }
  return text;
}

// Changes the language of the whole page
function setLanguage(language) {
  currentLanguage = language;
  document.documentElement.lang = language;

  // Fill every element that has a data-text attribute
  var elements = document.querySelectorAll("[data-text]");
  for (var i = 0; i < elements.length; i++) {
    elements[i].textContent = t(elements[i].getAttribute("data-text"));
  }

  // Highlight the selected language button
  document.getElementById("btn-en").className = (language === "en") ? "selected" : "";
  document.getElementById("btn-pt").className = (language === "pt") ? "selected" : "";

  // The day names and the period dates also change with the language
  updatePeriod();

  // The lists of other payments and deductions have texts in their menus
  buildExtraRows("payment");
  buildExtraRows("deduction");

  // If there is a result on the screen, write it again in the new language
  if (lastResult) {
    showResults(lastResult);
  }
}


/* =====================================================================
   3. DATES
   Dates are kept as text in the format YYYY-MM-DD (the same format as
   <input type="date">). We only turn them into Date objects to add days.
   We always create dates at midnight local time, so summer time
   does not move a date to the day before.
   ===================================================================== */

// "2026-11-03" -> Date
function textToDate(text) {
  var parts = text.split("-");
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

// Date -> "2026-11-03"
function dateToText(date) {
  var month = date.getMonth() + 1;
  var day = date.getDate();
  return date.getFullYear() + "-" +
         (month < 10 ? "0" : "") + month + "-" +
         (day < 10 ? "0" : "") + day;
}

// Returns the list of every day in the pay period, as text.
// Weekly = 7 days, fortnightly = 14 days.
// Monthly = from the start date to the day before the same date next month
// (1 Nov -> 30 Nov, 15 Jan -> 14 Feb). If the next month is shorter,
// we use its last day (31 Jan -> 27 Feb).
function getPeriodDays(startText, period) {
  var start = textToDate(startText);
  var numberOfDays;

  if (period === "monthly") {
    var year = start.getFullYear();
    var nextMonth = start.getMonth() + 1;
    var lastDayOfNextMonth = new Date(year, nextMonth + 1, 0).getDate();
    var nextStart = new Date(year, nextMonth, Math.min(start.getDate(), lastDayOfNextMonth));
    // Difference in days. Math.round fixes the 23 or 25 hour days of summer time.
    numberOfDays = Math.round((nextStart - start) / 86400000);
  } else {
    numberOfDays = PERIOD_DAYS[period];
  }

  var days = [];
  for (var i = 0; i < numberOfDays; i++) {
    var day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    days.push(dateToText(day));
  }
  return days;
}

// Splits the days of the period into weeks of 7 days, starting on the
// first day of the period. The last week of a month can be shorter.
function splitIntoWeeks(days) {
  var weeks = [];
  for (var i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

// Shows a date in the selected language, for example "Tue 3 Nov"
function formatDay(dateText, showWeekday) {
  var options = { day: "numeric", month: "short" };
  if (showWeekday) { options.weekday = "short"; }
  return textToDate(dateText).toLocaleDateString(t("locale"), options);
}


/* =====================================================================
   4. CALCULATIONS
   These functions only do the maths. They do not touch the page.
   ===================================================================== */

// Finds the minimum hourly rate for an age group on a date.
// Dates are text in the format YYYY-MM-DD, so we can compare them directly.
// Returns null if we have no rule for that date.
function getMinimumRate(dateText, ageGroup) {
  for (var i = 0; i < MINIMUM_WAGE_RULES.length; i++) {
    var rule = MINIMUM_WAGE_RULES[i];
    if (dateText >= rule.from && dateText <= rule.to) {
      return rule.rates[ageGroup];
    }
  }
  return null;
}

// Finds the MyFutureFund rates for a date, or null if there is no rule
function getMyFutureFundRule(dateText) {
  for (var i = 0; i < MY_FUTURE_FUND_RULES.length; i++) {
    var rule = MY_FUTURE_FUND_RULES[i];
    if (dateText >= rule.from && dateText <= rule.to) { return rule; }
  }
  return null;
}

// Returns true if the date is inside one of the Stamp 2 holiday periods:
// 1 June to 30 September, or 15 December to 15 January.
// A week only counts as holiday when every one of its days is in one
// of these periods (see calculate), so mixed weeks use the safer 20 hours.
function isHolidayPeriod(dateText) {
  var parts = dateText.split("-");
  var month = Number(parts[1]);
  var day = Number(parts[2]);

  if (month >= 6 && month <= 9) { return true; }     // June to September
  if (month === 12 && day >= 15) { return true; }    // from 15 December
  if (month === 1 && day <= 15) { return true; }     // until 15 January
  return false;
}

// Adds up the numbers in a list
function sum(list) {
  var total = 0;
  for (var i = 0; i < list.length; i++) { total += list[i]; }
  return total;
}

// Does all the checks and returns one object with the results.
// input.days has every date of the period.
// In "daily" mode input.dayHours and input.dayPay have one number per day.
function calculate(input) {
  var result = {};
  result.mode = input.mode;
  result.days = input.days;
  result.hours = input.hours;
  result.gross = input.gross;          // pay for the hours + other payments
  result.basic = input.basic;          // pay for the hours only
  result.countedPay = input.countedPay; // part that counts for the minimum wage
  result.extraPayments = input.extraPayments;
  result.extraDeductions = input.extraDeductions;
  result.extraPaymentsTotal = input.gross - input.basic;

  // --- Minimum wage ---
  // The rate of each day (it can change on 1 January)
  var rates = [];
  for (var i = 0; i < input.days.length; i++) {
    rates.push(getMinimumRate(input.days[i], input.age));
  }
  result.rateChanges = Math.min.apply(null, rates) !== Math.max.apply(null, rates);

  if (input.mode === "daily") {
    // Exact: the hours of each day times the rate of that day
    result.required = 0;
    for (var d = 0; d < input.days.length; d++) {
      result.required += input.dayHours[d] * rates[d];
    }
  } else {
    // We do not know which days the hours were worked, so we use the
    // average rate of the period. This only matters if the rate changes.
    result.required = input.hours * (sum(rates) / rates.length);
  }
  result.minRate = result.required / input.hours;
  // Only the reckonable pay counts (National Minimum Wage Act 2000, Schedule 1)
  result.paidRate = input.countedPay / input.hours;
  result.shortfall = result.required - input.countedPay;
  // We compare in cents to avoid problems with decimal numbers
  result.underpaid = Math.round(result.shortfall * 100) > 0;

  // --- Stamp 2 hours ---
  // The limit is per week, so we look at the period one week at a time
  var weeks = splitIntoWeeks(input.days);
  result.weeks = [];
  var allowedHours = 0;   // sum of the limits, used in "total" mode
  var holidayWeeks = 0;
  var partHolidayWeeks = 0;  // weeks that are part term time, part holiday
  var position = 0;       // position of the first day of the week in input.days

  for (var w = 0; w < weeks.length; w++) {
    var weekDays = weeks[w];
    var week = {};
    week.from = weekDays[0];
    week.to = weekDays[weekDays.length - 1];
    week.length = weekDays.length;
    // Safer rule: the 40-hour limit only applies when EVERY day of the
    // week is in a holiday period. A week that is part term time and part
    // holiday (for example 28 Sep to 4 Oct) keeps the 20-hour limit.
    var holidayDays = 0;
    for (var hd = 0; hd < weekDays.length; hd++) {
      if (isHolidayPeriod(weekDays[hd])) { holidayDays++; }
    }
    week.holiday = holidayDays === weekDays.length;
    week.partHoliday = holidayDays > 0 && !week.holiday;
    if (week.partHoliday) { partHolidayWeeks++; }
    week.limit = week.holiday ? HOURS_HOLIDAYS : HOURS_TERM_TIME;
    if (week.holiday) { holidayWeeks++; }

    // A short week (end of a month) gets a part of the limit
    allowedHours += week.limit * week.length / 7;

    if (input.mode === "daily") {
      week.hours = sum(input.dayHours.slice(position, position + week.length));
      week.over = week.hours > week.limit;
    }
    position += week.length;
    result.weeks.push(week);
  }

  result.holidayMix = holidayWeeks > 0 && holidayWeeks < weeks.length;
  result.allHoliday = holidayWeeks === weeks.length;
  result.partHoliday = partHolidayWeeks > 0;

  if (input.mode === "daily") {
    result.weeksOver = 0;
    for (var k = 0; k < result.weeks.length; k++) {
      if (result.weeks[k].over) { result.weeksOver++; }
    }
    result.overHours = result.weeksOver > 0;
  } else {
    // With only the total we can compare the average per week
    var numberOfWeeks = input.days.length / 7;
    result.averageHours = input.hours / numberOfWeeks;
    result.averageLimit = allowedHours / numberOfWeeks;
    result.overHours = input.hours > allowedHours + 0.001;
    // One full week: the total is the same as the week, so it is exact
    result.singleWeek = input.days.length === 7;
  }

  // --- Deductions (optional) ---
  result.paye = input.paye;
  result.usc = input.usc;
  result.prsi = input.prsi;
  result.myFuture = input.myFuture;
  result.extraDeductionsTotal = 0;
  for (var e = 0; e < input.extraDeductions.length; e++) {
    result.extraDeductionsTotal += input.extraDeductions[e].amount;
  }
  result.totalDeductions = input.paye + input.usc + input.prsi + input.myFuture +
                           result.extraDeductionsTotal;
  result.hasDeductions = result.totalDeductions > 0;
  result.hasTaxDeductions = input.paye + input.usc + input.prsi > 0;

  // MyFutureFund: we use the rates of the first day of the period
  result.mffRule = getMyFutureFundRule(input.days[0]);
  if (input.myFuture > 0 && result.mffRule) {
    result.mffExpected = input.gross * result.mffRule.employee;
    result.mffEmployer = input.gross * result.mffRule.employer;
    result.mffState = input.gross * result.mffRule.state;
    // A difference of up to 5 cents is only rounding
    result.mffDifferent = Math.abs(input.myFuture - result.mffExpected) > 0.05;
  }
  result.net = input.gross - result.totalDeductions;
  // PAYE above 20% of gross pay is unusual for part-time pay,
  // so we show a hint about emergency tax. It is only a hint.
  result.emergencyTaxHint = input.gross > 0 && (input.paye / input.gross) > 0.20;

  // PRSI limit for this period: 1 week, 2 weeks, or a month (52 weeks / 12)
  if (input.days.length === 7) {
    result.prsiLimit = PRSI_WEEKLY_THRESHOLD;
  } else if (input.days.length === 14) {
    result.prsiLimit = PRSI_WEEKLY_THRESHOLD * 2;
  } else {
    result.prsiLimit = PRSI_WEEKLY_THRESHOLD * 52 / 12;
  }
  // PRSI taken on pay at or below the limit is unusual, so we show a hint
  result.prsiHint = input.prsi > 0 && input.gross <= result.prsiLimit;

  return result;
}


/* =====================================================================
   5. FORM: pay period, entry mode and the day by day table
   ===================================================================== */

// Reads a number field. An empty field counts as 0.
function readNumber(id) {
  return textToNumber(document.getElementById(id).value);
}

// Turns typed text into a number. Empty or invalid text counts as 0.
function textToNumber(text) {
  var value = parseFloat(text);
  if (isNaN(value)) { return 0; }
  return value;
}

// Formats a number as euro, for example 254.7 becomes €254.70
function euro(amount) {
  return "€" + amount.toFixed(2);
}

// Shows hours without long decimals, for example 37.5 or 20
function hoursText(hours) {
  return String(Math.round(hours * 100) / 100);
}

// Returns "total" or "daily", depending on the radio button chosen
function getMode() {
  return document.querySelector("input[name='mode']:checked").value;
}

// Returns the days of the period chosen in the form,
// or an empty list if there is no start date yet
function getFormDays() {
  var start = document.getElementById("startDate").value;
  if (start === "") { return []; }
  return getPeriodDays(start, document.getElementById("period").value);
}

// Shows the part of the form for the chosen mode
function setMode() {
  var daily = getMode() === "daily";
  document.getElementById("totalEntry").hidden = daily;
  document.getElementById("dailyEntry").hidden = !daily;
}

// Runs when the period or the start date changes
function updatePeriod() {
  var days = getFormDays();
  var info = document.getElementById("periodInfo");

  if (days.length === 0) {
    info.textContent = "";
  } else {
    info.textContent = t("periodInfo", {
      from: formatDay(days[0], true),
      to: formatDay(days[days.length - 1], true),
      days: days.length
    });
  }
  buildDayTable(days);
}

// Creates one row of the table for each day of the period.
// The values the user typed are kept in dayValues, so they come back
// if the period or the language changes.
function buildDayTable(days) {
  var area = document.getElementById("dayList");
  area.innerHTML = "";

  if (days.length === 0) {
    var hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = t("dailyNeedDate");
    area.appendChild(hint);
    updateDailyTotals();
    return;
  }

  var scroll = document.createElement("div");
  scroll.className = "day-scroll";
  var table = document.createElement("table");
  table.className = "day-table";

  // Header: Day | Hours | Gross pay
  var head = document.createElement("thead");
  var headRow = document.createElement("tr");
  var columns = ["colDay", "colHours", "colPay"];
  for (var c = 0; c < columns.length; c++) {
    var th = document.createElement("th");
    th.scope = "col";
    th.textContent = t(columns[c]);
    headRow.appendChild(th);
  }
  head.appendChild(headRow);
  table.appendChild(head);

  var body = document.createElement("tbody");
  for (var i = 0; i < days.length; i++) {
    // A heading row before every 7 days
    if (i % 7 === 0) {
      var weekRow = document.createElement("tr");
      weekRow.className = "week-row";
      var weekCell = document.createElement("th");
      weekCell.colSpan = 3;
      weekCell.scope = "colgroup";
      weekCell.textContent = t("weekHeading", { n: i / 7 + 1 });
      weekRow.appendChild(weekCell);
      body.appendChild(weekRow);
    }
    body.appendChild(makeDayRow(days[i]));
  }
  table.appendChild(body);
  scroll.appendChild(table);
  area.appendChild(scroll);

  updateDailyTotals();
}

// One row: the date, an hours field and a pay field
function makeDayRow(dateText) {
  if (!dayValues[dateText]) {
    dayValues[dateText] = { hours: "", pay: "" };
  }
  var dayName = formatDay(dateText, true);

  var row = document.createElement("tr");
  var dayCell = document.createElement("td");
  dayCell.textContent = dayName;
  row.appendChild(dayCell);

  row.appendChild(makeDayInput(dateText, "hours", "0.25", t("ariaHours", { day: dayName })));
  row.appendChild(makeDayInput(dateText, "pay", "0.01", t("ariaPay", { day: dayName })));
  return row;
}

// One number field inside the table. "field" is "hours" or "pay".
function makeDayInput(dateText, field, step, label) {
  var cell = document.createElement("td");
  var input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = step;
  input.inputMode = "decimal";
  input.setAttribute("aria-label", label);
  input.value = dayValues[dateText][field];
  input.oninput = function () {
    dayValues[dateText][field] = input.value;
    updateDailyTotals();
  };
  cell.appendChild(input);
  return cell;
}

// Adds up the days of the period that is on the screen
function getDailyTotals(days) {
  var totals = { hours: 0, gross: 0, dayHours: [], dayPay: [], negative: false };
  for (var i = 0; i < days.length; i++) {
    var saved = dayValues[days[i]] || { hours: "", pay: "" };
    var hours = textToNumber(saved.hours);
    var pay = textToNumber(saved.pay);
    if (hours < 0 || pay < 0) { totals.negative = true; }
    totals.dayHours.push(hours);
    totals.dayPay.push(pay);
    totals.hours += hours;
    totals.gross += pay;
  }
  return totals;
}

// Updates the "Total: ..." line under the table
function updateDailyTotals() {
  var days = getFormDays();
  var line = document.getElementById("dailyTotals");
  if (days.length === 0) { line.textContent = ""; return; }
  var totals = getDailyTotals(days);
  line.textContent = t("dailyTotals", { hours: hoursText(totals.hours), gross: euro(totals.gross) });
}


// ---------- Other payments and other deductions ----------

// Finds the rule of a payment type, for example "sunday"
function getPaymentType(id) {
  for (var i = 0; i < EXTRA_PAYMENT_TYPES.length; i++) {
    if (EXTRA_PAYMENT_TYPES[i].id === id) { return EXTRA_PAYMENT_TYPES[i]; }
  }
  return null;
}

// The list of type ids for "payment" or "deduction"
function getTypeIds(kind) {
  if (kind === "deduction") { return EXTRA_DEDUCTION_TYPES; }
  var ids = [];
  for (var i = 0; i < EXTRA_PAYMENT_TYPES.length; i++) { ids.push(EXTRA_PAYMENT_TYPES[i].id); }
  return ids;
}

// Runs when the user clicks "Add a payment" or "Add a deduction"
function addExtra(kind) {
  extraItems[kind].push({ type: getTypeIds(kind)[0], amount: "" });
  buildExtraRows(kind);
  // Put the cursor in the menu of the new line
  var selects = document.querySelectorAll("#" + listId(kind) + " select");
  selects[selects.length - 1].focus();
}

function removeExtra(kind, index) {
  extraItems[kind].splice(index, 1);
  buildExtraRows(kind);
}

function listId(kind) {
  return kind === "payment" ? "extraPayments" : "extraDeductions";
}

// Draws the lines of one list from extraItems
function buildExtraRows(kind) {
  var area = document.getElementById(listId(kind));
  area.innerHTML = "";
  var prefix = kind === "payment" ? "pay_" : "ded_";
  var ids = getTypeIds(kind);

  for (var i = 0; i < extraItems[kind].length; i++) {
    area.appendChild(makeExtraRow(kind, i, prefix, ids));
  }
}

// One line: menu with the type, amount and a Remove button
function makeExtraRow(kind, index, prefix, ids) {
  var item = extraItems[kind][index];
  var row = document.createElement("div");
  row.className = "extra-row";

  var select = document.createElement("select");
  select.setAttribute("aria-label", t("ariaType", { n: index + 1 }));
  for (var i = 0; i < ids.length; i++) {
    var option = document.createElement("option");
    option.value = ids[i];
    option.textContent = t(prefix + ids[i]);
    select.appendChild(option);
  }
  select.value = item.type;
  select.onchange = function () { item.type = select.value; };
  row.appendChild(select);

  var input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "0.01";
  input.inputMode = "decimal";
  input.setAttribute("aria-label", t("ariaAmount", { n: index + 1 }));
  input.value = item.amount;
  input.oninput = function () { item.amount = input.value; };
  row.appendChild(input);

  var remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = t("removeButton");
  remove.onclick = function () { removeExtra(kind, index); };
  row.appendChild(remove);

  return row;
}

// Returns the lines with an amount, as numbers.
// Returns null if an amount is negative.
function readExtraItems(kind) {
  var list = [];
  for (var i = 0; i < extraItems[kind].length; i++) {
    var amount = textToNumber(extraItems[kind][i].amount);
    if (amount < 0) { return null; }
    if (amount > 0) { list.push({ type: extraItems[kind][i].type, amount: amount }); }
  }
  return list;
}


/* =====================================================================
   6. PAGE: validate and show the results
   ===================================================================== */

function showError(message) {
  lastResult = null;
  var box = document.getElementById("results");
  box.innerHTML = "";
  var p = document.createElement("p");
  p.className = "error";
  p.textContent = message;
  box.appendChild(p);
}

// Runs when the user clicks "Check my pay"
function checkPay() {
  var input = {
    age:   document.getElementById("age").value,
    mode:  getMode(),
    days:  getFormDays(),
    paye:  readNumber("paye"),
    usc:   readNumber("usc"),
    prsi:  readNumber("prsi"),
    myFuture: readNumber("myfuture")
  };

  // Validation: stop and explain if something is missing or wrong
  if (input.days.length === 0) { showError(t("errorDate")); return; }

  if (input.mode === "daily") {
    var totals = getDailyTotals(input.days);
    if (totals.negative) { showError(t("errorNegative")); return; }
    if (totals.hours <= 0) { showError(t("errorDailyHours")); return; }
    if (totals.gross <= 0) { showError(t("errorDailyGross")); return; }
    input.hours = totals.hours;
    input.basic = totals.gross;
    input.dayHours = totals.dayHours;
    input.dayPay = totals.dayPay;
  } else {
    input.hours = readNumber("hours");
    input.basic = readNumber("gross");
    if (input.hours <= 0) { showError(t("errorHours")); return; }
    if (input.basic <= 0) { showError(t("errorGross")); return; }
  }

  // Other payments and deductions. Empty lines are ignored.
  input.extraPayments = readExtraItems("payment");
  input.extraDeductions = readExtraItems("deduction");
  if (input.extraPayments === null || input.extraDeductions === null) {
    showError(t("errorNegative")); return;
  }
  input.gross = input.basic;
  input.countedPay = input.basic;
  for (var p = 0; p < input.extraPayments.length; p++) {
    var item = input.extraPayments[p];
    input.gross += item.amount;
    if (getPaymentType(item.type).countsForMinimumWage) {
      input.countedPay += item.amount;
    }
  }
  var extraDeductionsTotal = 0;
  for (var q = 0; q < input.extraDeductions.length; q++) {
    extraDeductionsTotal += input.extraDeductions[q].amount;
  }

  if (input.paye < 0 || input.usc < 0 || input.prsi < 0 || input.myFuture < 0 ||
      input.paye + input.usc + input.prsi + input.myFuture + extraDeductionsTotal > input.gross) {
    showError(t("errorDeductions")); return;
  }

  // Every day of the period needs a minimum wage rule
  for (var i = 0; i < input.days.length; i++) {
    if (getMinimumRate(input.days[i], input.age) === null) {
      showError(t("errorNoRule")); return;
    }
  }

  lastResult = calculate(input);
  showResults(lastResult);
}

// Small helper: creates one result box with a title and paragraphs.
// We use textContent (not innerHTML) so user input is never run as code.
function makeBox(title, paragraphs, needsAttention) {
  var box = document.createElement("div");
  box.className = needsAttention ? "result attention" : "result";

  var heading = document.createElement("h3");
  heading.textContent = title;
  box.appendChild(heading);

  for (var i = 0; i < paragraphs.length; i++) {
    var p = document.createElement("p");
    p.textContent = paragraphs[i];
    if (i === 0) { p.style.fontWeight = "bold"; }
    box.appendChild(p);
  }
  return box;
}

// Writes the results on the page
function showResults(r) {
  var area = document.getElementById("results");
  area.innerHTML = "";

  var title = document.createElement("h2");
  title.textContent = t("resultsTitle");
  area.appendChild(title);

  var summary = document.createElement("p");
  summary.textContent = t("resultsPeriod", {
    from: formatDay(r.days[0], true),
    to: formatDay(r.days[r.days.length - 1], true),
    days: r.days.length,
    hours: hoursText(r.hours),
    gross: euro(r.gross)
  });
  area.appendChild(summary);

  // --- Box 1: minimum wage ---
  var wageLines = [];
  wageLines.push(r.underpaid ? t("wageLow") : t("wageOk"));
  wageLines.push(t("wageDetail", { paid: euro(r.paidRate), min: euro(r.minRate) }));
  if (r.underpaid) {
    wageLines.push(t("wageShort", {
      hours: hoursText(r.hours), required: euro(r.required), diff: euro(r.shortfall)
    }));
  }
  if (r.countedPay < r.gross - 0.005) {
    wageLines.push(t("wageCounted", { counted: euro(r.countedPay), total: euro(r.gross) }));
  }
  if (r.rateChanges) {
    wageLines.push(r.mode === "daily" ? t("wageRateChangeDaily") : t("wageRateChangeTotal"));
  }
  area.appendChild(makeBox(t("wageTitle"), wageLines, r.underpaid));

  // --- Box: other payments (only if the user added them) ---
  if (r.extraPayments.length > 0) {
    var extraLines = [];
    extraLines.push(t("extraSummary", {
      total: euro(r.extraPaymentsTotal), basic: euro(r.basic), gross: euro(r.gross)
    }));
    for (var x = 0; x < r.extraPayments.length; x++) {
      var payment = r.extraPayments[x];
      var counts = getPaymentType(payment.type).countsForMinimumWage;
      extraLines.push(t("pay_" + payment.type) + ": " + euro(payment.amount) + ". " +
                      t("pay_" + payment.type + "_text") + " " +
                      (counts ? t("countsYes") : t("countsNo")));
    }
    area.appendChild(makeBox(t("extraTitle"), extraLines, false));
  }

  // --- Box 2: Stamp 2 hours ---
  area.appendChild(makeBox(t("hoursTitle"), hoursLines(r), r.overHours));

  // --- Box 3: deductions (only if the user typed them) ---
  if (r.hasDeductions) {
    var dedLines = [];
    dedLines.push(t("dedSummary", { total: euro(r.totalDeductions), net: euro(r.net) }));
    dedLines.push("PAYE: " + deductionLine(r.paye, r.gross) + ". " + t("payeText"));
    dedLines.push("USC: " + deductionLine(r.usc, r.gross) + ". " + t("uscText"));
    dedLines.push("PRSI: " + deductionLine(r.prsi, r.gross) + ". " + t("prsiText", { limit: euro(r.prsiLimit) }));
    if (r.prsiHint) { dedLines.push(t("prsiCheck", { limit: euro(r.prsiLimit) })); }
    if (r.myFuture > 0) {
      dedLines.push("MyFutureFund: " + deductionLine(r.myFuture, r.gross) + ". " + myFutureFundText(r));
    }
    for (var y = 0; y < r.extraDeductions.length; y++) {
      var deduction = r.extraDeductions[y];
      dedLines.push(t("ded_" + deduction.type) + ": " + deductionLine(deduction.amount, r.gross) +
                    ". " + t("ded_" + deduction.type + "_text"));
    }
    if (r.extraDeductions.length > 0) { dedLines.push(t("dedLaw")); }
    if (r.emergencyTaxHint) { dedLines.push(t("emergencyTax")); }
    area.appendChild(makeBox(t("dedTitle"), dedLines, r.emergencyTaxHint || r.mffDifferent || r.prsiHint));
  }

  // --- Box 4: who to contact, chosen from the results above ---
  // Citizens Information comes first and is always shown: it gives
  // confidential advice before the person decides on a formal complaint.
  var contacts = [t("contactCitizens")];
  if (r.underpaid) { contacts.push(t("contactWrc")); }
  if (r.hasTaxDeductions) { contacts.push(t("contactRevenue")); }
  if (r.mffDifferent) { contacts.push(t("contactPayroll")); }
  if (r.myFuture > 0) { contacts.push(t("contactMff")); }
  if (r.extraDeductions.length > 0) { contacts.push(t("contactWrcDeductions")); }
  if (r.overHours) { contacts.push(t("contactImmigration")); }

  var contactBox = document.createElement("div");
  contactBox.className = "result";
  var contactTitle = document.createElement("h3");
  contactTitle.textContent = t("contactTitle");
  contactBox.appendChild(contactTitle);
  var list = document.createElement("ul");
  for (var i = 0; i < contacts.length; i++) {
    var item = document.createElement("li");
    item.textContent = contacts[i];
    list.appendChild(item);
  }
  contactBox.appendChild(list);
  area.appendChild(contactBox);
}

// The lines of the Stamp 2 box
function hoursLines(r) {
  var lines = [];

  if (r.mode === "daily") {
    // We know the hours of every week, so we check each one
    if (r.overHours) {
      lines.push(t("hoursWeeksOver", { count: r.weeksOver, total: r.weeks.length }));
    } else {
      lines.push(t("hoursWeeksOk"));
    }
    for (var i = 0; i < r.weeks.length; i++) {
      var week = r.weeks[i];
      var line = t("weekLine", {
        n: i + 1,
        from: formatDay(week.from, false),
        to: formatDay(week.to, false),
        hours: hoursText(week.hours),
        limit: week.limit,
        status: week.over ? t("weekOver") : t("weekOk")
      });
      if (week.length < 7) { line += " " + t("weekPartial", { days: week.length }); }
      lines.push(line);
    }
  } else if (r.singleWeek) {
    // Weekly pay: the total is exactly one week
    var values = { hours: hoursText(r.hours), limit: r.weeks[0].limit };
    lines.push(r.overHours ? t("hoursOver", values) : t("hoursOk", values));
  } else {
    // Fortnightly or monthly total: we can only compare the average
    var avgValues = {
      hours: hoursText(r.hours),
      days: r.days.length,
      avg: hoursText(r.averageHours),
      limit: hoursText(r.averageLimit)
    };
    lines.push(r.overHours ? t("hoursAvgOver", avgValues) : t("hoursAvgOk", avgValues));
    lines.push(t("hoursAvgNote"));
  }

  if (r.holidayMix) {
    lines.push(t("hoursMixed"));
  } else if (!r.partHoliday) {
    lines.push(r.allHoliday ? t("hoursHoliday") : t("hoursTerm"));
  }
  if (r.partHoliday) { lines.push(t("hoursPartWeek")); }
  if (r.overHours) { lines.push(t("hoursWarning")); }
  return lines;
}

// Shows a rate such as 0.015 as "1.5"
function percentText(rate) {
  return String(Math.round(rate * 1000) / 10);
}

// The explanation of MyFutureFund, with the amounts for this period
function myFutureFundText(r) {
  var rule = r.mffRule;
  if (!rule) { return ""; }
  var text = t("mffText", {
    employee: percentText(rule.employee),
    employer: percentText(rule.employer),
    state: percentText(rule.state)
  });
  var check = r.mffDifferent ? "mffDifferent" : "mffMatch";
  text += " " + t(check, {
    employee: percentText(rule.employee),
    gross: euro(r.gross),
    expected: euro(r.mffExpected),
    paid: euro(r.myFuture)
  });
  text += " " + t("mffSaved", {
    employer: euro(r.mffEmployer),
    state: euro(r.mffState),
    total: euro(r.myFuture + r.mffEmployer + r.mffState)
  });
  text += " " + t("mffEligibility");
  return text;
}

// Text for one deduction, for example "€5.40 (1.5% of your gross pay)"
function deductionLine(amount, gross) {
  return t("dedOf", { amount: euro(amount), percent: percentText(amount / gross) });
}

// Empties the form and removes the results
function clearForm() {
  var ids = ["startDate", "hours", "gross", "paye", "usc", "prsi", "myfuture"];
  for (var i = 0; i < ids.length; i++) {
    document.getElementById(ids[i]).value = "";
  }
  document.getElementById("age").value = "adult";
  document.getElementById("period").value = "weekly";
  document.querySelector("input[name='mode'][value='total']").checked = true;
  dayValues = {};
  extraItems = { payment: [], deduction: [] };
  buildExtraRows("payment");
  buildExtraRows("deduction");
  setMode();
  updatePeriod();
  document.getElementById("payslipDetails").open = false;
  document.getElementById("results").innerHTML = "";
  lastResult = null;
}

// Start the page in English
setLanguage("en");
