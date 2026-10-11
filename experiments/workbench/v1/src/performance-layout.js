// Presentation only: keep the existing controls, form and editor instances.
// Moving the form preserves its handlers and unfinished title while playing.
export function initPerformanceLayout(ui) {
  const {body,detailButton,codeLink,listenButton,libraryButton,library,libraryTitle,
    draftDetails,feedback,draftForm,status,fullDetails} = ui;
  const formHome=draftForm.parentNode, formNext=draftForm.nextSibling;
  const statusHome=status.parentNode, statusNext=status.nextSibling;
  const originalTitle=libraryTitle.textContent;
  const openedByDetail=new Set();
  let active=false;

  function listening(enabled) {
    body.classList.toggle('listening-view',enabled);
    listenButton.setAttribute('aria-pressed',String(enabled));
    listenButton.textContent=enabled?'操作に戻る':'聴くだけ';
  }
  function detailed(enabled) {
    body.classList.toggle('set-detailed-view',enabled);
    detailButton.setAttribute('aria-pressed',String(enabled));
    detailButton.textContent=enabled?'シンプル表示へ':'全操作を開く';
    for (const detail of fullDetails) {
      if (enabled && !detail.open) { openedByDetail.add(detail);detail.open=true; }
      else if (!enabled && openedByDetail.has(detail)) detail.open=false;
    }
    if (!enabled) openedByDetail.clear();
  }
  function saved(enabled) {
    body.classList.toggle('set-library-visible',enabled);
    libraryButton.setAttribute('aria-expanded',String(enabled));
    libraryButton.textContent=enabled?'保存版を閉じる':'保存版を開く';
    if (enabled) { listening(false);draftDetails.open=true;library.scrollIntoView({block:'start'}); }
  }
  detailButton.addEventListener('click',()=>{ listening(false);detailed(!body.classList.contains('set-detailed-view')); });
  codeLink.addEventListener('click',()=>{ listening(false);detailed(true); });
  listenButton.addEventListener('click',()=>listening(!body.classList.contains('listening-view')));
  libraryButton.addEventListener('click',()=>saved(!body.classList.contains('set-library-visible')));
  detailed(false);

  return {
    show(enabled) {
      body.classList.toggle('performance-view',enabled);
      if (active===enabled) return;
      active=enabled;
      if (enabled) {
        feedback.append(draftForm,status);
        libraryTitle.textContent='保存版・バックアップ';
      } else {
        statusHome.insertBefore(status,statusNext);
        formHome.insertBefore(draftForm,formNext);
        libraryTitle.textContent=originalTitle;
        listening(false);saved(false);
      }
    },
  };
}
