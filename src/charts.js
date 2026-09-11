const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function barChart(data, {label, format = String, maximum} = {}) {
  const peak = Math.max(1, maximum || 0, ...data.map(x => Math.max(0, x.value || 0)));
  const step = Math.max(1, Math.ceil(peak / 4));
  const ceiling = step * 4;
  return `<figure class="data-chart" aria-label="${escape(label)}"><figcaption>${escape(label)}</figcaption>${data.map((x,index)=>`<div class="chart-row"><span class="chart-label">${escape(x.label)}</span><div class="chart-plot"><span class="chart-bar chart-color-${index % 5}" style="width:${Math.max(0,x.value || 0)/ceiling*100}%"></span></div><strong class="chart-value">${escape(format(x.value || 0))}</strong></div>`).join('')}<div class="chart-axis" aria-hidden="true"><span></span><div>${Array.from({length:5},(_,i)=>`<span>${escape(format(i*step))}</span>`).join('')}</div><span></span></div></figure>`;
}
