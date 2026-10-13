// Small vector fallback: no WebGL, polygon projection engine or remote assets needed.
export function createHouseFallback(){
  const domElement=document.createElement('div');domElement.className='house-lite';
  domElement.innerHTML=`<svg viewBox="0 0 900 650" role="presentation" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="liteFloor" x2="1" y2="1"><stop stop-color="#6e706b"/><stop offset="1" stop-color="#313c40"/></linearGradient><radialGradient id="liteLight"><stop stop-color="#ffe0a3" stop-opacity=".7"/><stop offset="1" stop-color="#ffe0a3" stop-opacity="0"/></radialGradient></defs>
  <path d="M75 365L435 150 825 355 475 590Z" fill="#183c43"/><path d="M75 365V394L475 620V590Z" fill="#102b34"/><path d="M475 590L825 355V384L475 620Z" fill="#0b2530"/>
  <path d="M150 340L435 174 750 341 466 515Z" fill="url(#liteFloor)" stroke="#75887e" stroke-width="4"/>
  <path d="M150 340V159L435 20V174Z" fill="#72817c"/><path d="M435 20L750 189V341L435 174Z" fill="#213d46" stroke="#36505a" stroke-width="6"/>
  <path d="M466 515V430L750 257V341Z" fill="#566e6b"/><path d="M455 175L455 245 305 333 305 266Z" fill="#7c8580"/>
  <g stroke="#65756d" opacity=".4"><path d="M180 357L471 188M215 375L510 209M250 394L549 231M285 414L588 252M320 432L627 273M355 451L666 294M390 471L705 315"/></g>
  <ellipse data-lite="main" cx="330" cy="345" rx="155" ry="108" fill="url(#liteLight)" opacity="0"/>
  <path d="M171 168L421 42" fill="none" stroke="#ffd4a1" stroke-width="7" data-lite="indirect" opacity="0"/>
  <g><path d="M223 339L319 284 412 330 318 388Z" fill="#537b75"/><path d="M223 339V381L318 434V388Z" fill="#355c57"/><path d="M318 388L412 330V372L318 434Z" fill="#274846"/><path d="M232 338V307L329 253V283Z" fill="#73958b"/></g>
  <path d="M416 375L443 357 477 375 450 394Z" fill="#c5a16b"/><path d="M450 394V426L454 426V394Z" fill="#223c41"/>
  <path d="M547 360L620 316 687 352 614 402Z" fill="#779995"/><path d="M547 360V384L614 426V402Z" fill="#496763"/><path d="M614 402L687 352V377L614 426Z" fill="#35534f"/>
  <path d="M492 166L628 238 628 271 492 199Z" fill="#aa8b63"/><path d="M492 166L522 148 658 222 628 238Z" fill="#c0bca7"/>
  <path d="M191 224L191 148 278 104V179Z" fill="#071721" stroke="#122b36" stroke-width="8"/>
  <path data-lite="tv" d="M198 214V153L269 118V175Z" fill="#70b3e5" opacity="0"/>
  <path d="M324 138L380 110V136L324 165Z" fill="#bbc6ba" stroke="#6f8884" stroke-width="3"/>
  <g data-lite="ac" stroke="#9deeff" stroke-width="3" fill="none" opacity="0"><path d="M345 165Q365 200 393 218T435 280"/><path d="M355 158Q379 200 405 218T449 275"/><path d="M365 152Q390 190 417 209T464 269"/></g>
  <path data-lite="curtains" d="M455 37L718 181V325L455 179Z" fill="#baa98c" opacity="0"/>
  <circle data-lite="security" cx="730" cy="265" r="6" fill="#baf1a0" opacity="0"/>
  <path data-lite="entry" d="M428 522L466 544 508 522" stroke="#ffddac" stroke-width="6" fill="none" opacity="0"/>
  <path data-lite="roof" d="M129 160L432 0 771 178 466 356Z" fill="#b7c1b1" stroke="#516b6a" stroke-width="6" visibility="hidden"/>
  </svg>`;
  return {domElement,render(){},setSize(){},setRoof(show){domElement.querySelector('[data-lite="roof"]').setAttribute('visibility',show?'visible':'hidden');},update(state){for(const [key,value] of Object.entries(state)){const object=domElement.querySelector(`[data-lite="${key}"]`);if(object)object.setAttribute('opacity',String(value));}}};
}
