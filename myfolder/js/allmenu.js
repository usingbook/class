(function ($) {
  /* ========= 설정 ========= */
  var SOURCE_MODE = 'easy-preferred';     // 'category-only' | 'easy-only' | 'easy-preferred'
  var USE_SEO_LINKS_FOR_CATEGORY = false; // true면 category 링크를 SEO 경로로 강제
  var BREAKPOINT = 1024;                  // (옵션) 반응형 제어에 사용

  /* ========= 유틸 ========= */
  function normalizeHref(href){ return (href||'#').replace(/([^:])\/{2,}/g,'$1/'); }
  function slugify(str){ return (str||'').trim().toLowerCase()
    .replace(/[^\w\u3131-\uD79D\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-'); }
  function seoLinkCategory(name,no){ return '/category/'+(slugify(name)||'category')+'/'+no+'/'; }

  // cate_no 추출: /category/.../123/ | /project/.../60/ | ?cate_no=123
  function getCateNoFromHref(href){
    href = normalizeHref(href);
    var m;
    if ((m = href.match(/\/category\/[^/]+\/(\d+)\//i))) return String(m[1]);
    if ((m = href.match(/\/project\/[^/]+\/(\d+)\//i)))  return String(m[1]);
    if ((m = href.match(/[?&]cate_no=(\d+)/i)))          return String(m[1]);
    return null;
  }
  // 타입 판별
  function getCateTypeFromHref(href){
    var url = normalizeHref(href).toLowerCase();
    if (url.includes('/project/') || url.includes('/product/project.html')) return 'project';
    if (url.includes('/category/')|| url.includes('/product/list.html'))    return 'category';
    return 'external';
  }

  function getCurrentPageInfo(){
    var href = normalizeHref(location.href);
    return {
      type: getCateTypeFromHref(href),
      cateNo: getCateNoFromHref(href),
      path: location.pathname.replace(/\/{2,}/g,'/').toLowerCase()
    };
  }

  /* ========= 데이터 ========= */
  function loadCategoryMap(){
    // parent_cate_no -> children[]
    return $.getJSON('/exec/front/Product/SubCategory').then(function(rows){
      var map = {};
      (rows||[]).forEach(function(r){
        var p = String(r.parent_cate_no);
        (map[p]||(map[p]=[])).push(r);
      });
      return map;
    });
  }

  /* ========= 렌더 ========= */
  function createNode(name, href, depth, cateNo, type){
    var $li = $('<li>',{
      'class':'mega__item mega__item--d'+depth,
      'data-depth':depth,'data-cate':cateNo||'','data-type':type||''
    });
    var $a = $('<a>',{'class':'mega__link mega__link--d'+depth, href: href||'#', text: name||''});
    $li.append($a);
    return $li;
  }

  function renderChildren($parentLi, parentNo, map, depth){
    var kids = map[String(parentNo)];
    if(!kids||!kids.length) return;

    var $ul = $('<ul>',{'class':'mega__list mega__list--d'+depth,'data-depth':depth});
    kids.forEach(function(child){
      var name  = child.name || child.cate_name || '';
      var cateNo= String(child.cate_no);
      var href  = USE_SEO_LINKS_FOR_CATEGORY ? seoLinkCategory(name,cateNo)
                  : (child.link_product_list || child.link || '/product/list.html?cate_no='+cateNo);
      var $li   = createNode(name, href, depth, cateNo, 'category');

      if (map[cateNo]) renderChildren($li, cateNo, map, depth+1); // 필요 시 더 내려감
      $ul.append($li);
    });
    $parentLi.append($ul);
  }

  function markCurrentMenu($root){
    var info = getCurrentPageInfo();
    if (info.cateNo){
      $root.find('.mega__item--d1[data-type="'+info.type+'"][data-cate="'+info.cateNo+'"] > .mega__link')
           .addClass('is-current');
    } else if (info.path){
      $root.find('.mega__item--d1[data-type="external"] > .mega__link').each(function(){
        var href = normalizeHref(this.getAttribute('href')||'').toLowerCase();
        if (!href || href==='#') return;
        try {
          var u = new URL(href, location.origin);
          if (u.pathname.toLowerCase() === info.path) $(this).addClass('is-current');
        } catch(e){}
      });
    }
  }

  function buildMenu(categoryMap){
    // L1 소스: Easy 메뉴
    var $easyL1 = (SOURCE_MODE==='category-only') ? $() :
      $('[data-ez-module="menu-main/1"] .xans-layout-category > ul > li');

    // ★ 출력 타깃: [data-role="mega-mount"] (없으면 .top_category로 폴백)
    var $target = $('[data-role="mega-mount"]');
    if (!$target.length) $target = $('.top_category');
    if (!$target.length) return;

    var $rootUL = $('<ul class="mega__list mega__list--d1" data-depth="1" />');

    $easyL1.each(function(){
      var $src  = $(this);
      var $a1   = $src.children('a').first();
      if(!$a1.length) return;

      var raw   = normalizeHref($a1.attr('href')||'#');
      var name  = $.trim($a1.text());
      var type  = getCateTypeFromHref(raw);    // category | project | external
      var no    = getCateNoFromHref(raw);

      var href  = (USE_SEO_LINKS_FOR_CATEGORY && type==='category' && no)
                    ? seoLinkCategory(name,no) : raw;

      var $li   = createNode(name, href, 1, no, type);

      // Easy가 수동 하위 UL을 제공하면 그대로 복제(운영 의도 우선)
      var $easySub = $src.children('ul').first();
      if ($easySub.length){
        var $cloned = $easySub.clone(true,true)
                        .removeClass()
                        .addClass('mega__list mega__list--d2')
                        .attr('data-depth',2);
        $li.append($cloned);
      } else {
        if (type==='category' && no && categoryMap){
          renderChildren($li, no, categoryMap, 2);
        }
        // project/external 은 leaf
      }

      $rootUL.append($li);
    });

    // 대상 영역 교체
    var $old = $target.children('ul').first();
    if ($old.length) $old.replaceWith($rootUL); else $target.append($rootUL);

    // 현재 위치 강조
    markCurrentMenu($target);

    // 접근성/상태 표시
    $('body').addClass('allmenu-mega');
    $('#allmenu').attr('aria-hidden','false');
  }

  /* ========= 초기화 ========= */
  $(function(){
    // category 타입이 하나라도 있으면 맵 로드
    var needMap = false;
    $('[data-ez-module="menu-main/1"] .xans-layout-category > ul > li > a').each(function(){
      if (getCateTypeFromHref(this.getAttribute('href')||'')==='category'){ needMap=true; return false; }
    });

    var ready = needMap ? loadCategoryMap() : $.Deferred().resolve(null).promise();
    ready.then(buildMenu);

  });
})(jQuery);


// 햄버거 토글 + ≤1024 자동 닫힘 (최적화본)
(function ($) {
  $(function () {
    var BREAKPOINT = 1024;
    var $menu = $('#allmenu');
    var $btn  = $('#btnHamburger');

    if (!$menu.length || !$btn.length) return; // 필수 요소 가드

    // 델리게이션으로 백드롭/닫기 요소 모두 처리
    $(document)
      .off('click.allmenu')
      .on('click.allmenu', '#allmenu .allmenu__backdrop, [data-close="#allmenu"], #allmenu [data-close]', safeClose);

    function getScrollbarWidth() {
      return window.innerWidth - document.documentElement.clientWidth;
    }

    function openMenu() {
      // 스크롤락 + 폭 보정 (필요한 경우에만 세팅)
      var sbw = getScrollbarWidth();
      $('body').addClass('no-scroll').css('padding-right', sbw ? sbw + 'px' : '');

      $menu.addClass('is-active').attr('aria-hidden', 'false');
      $btn.addClass('is-active').attr('aria-expanded', 'true');
    }

    function safeClose() {
      if (!$menu.hasClass('is-active')) return;

      // 상태 복원 (DOM 변경 최소화)
      $menu.removeClass('is-active').attr('aria-hidden', 'true');
      $btn.removeClass('is-active').attr('aria-expanded', 'false');
      $('body').removeClass('no-scroll').css('padding-right', '');
    }

    // 버튼 토글
    $btn.off('click.allmenu').on('click.allmenu', function () {
      $menu.hasClass('is-active') ? safeClose() : openMenu();
    });

    // ESC 닫기
    $(document).off('keydown.allmenu').on('keydown.allmenu', function (e) {
      if (e.key === 'Escape' && $menu.hasClass('is-active')) safeClose();
    });

    // 1024px 이하 진입 시 자동 닫기 (변화 감지 + 초기 체크 + 폴백)
    var mq = window.matchMedia('(max-width:' + BREAKPOINT + 'px)');
    function onChange(e) { if (e.matches) safeClose(); }
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange); // 구형 폴백
    if (mq.matches) safeClose();

    // 리사이즈 폴백(디바운스)
    var t;
    $(window).off('resize.allmenu').on('resize.allmenu', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        if (window.innerWidth <= BREAKPOINT) safeClose();
      }, 120);
    });
  });
})(jQuery);


