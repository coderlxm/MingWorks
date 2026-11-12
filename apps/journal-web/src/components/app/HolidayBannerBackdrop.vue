<script setup lang="ts" name="HolidayBannerBackdrop">
import { useId } from 'vue';
import type { JournalHolidayId } from '../../types';

defineProps<{
  holiday: JournalHolidayId;
}>();

const id = useId();
</script>

<template>
  <div class="holiday-backdrop" :class="`holiday-backdrop--${holiday}`" aria-hidden="true">
    <svg class="holiday-backdrop__pattern" width="100%" height="100%" focusable="false">
      <defs>
        <linearGradient :id="`${id}-gold`" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ebd5a7" />
          <stop offset="0.55" stop-color="#c9a25e" />
          <stop offset="1" stop-color="#a87f3e" />
        </linearGradient>
        <linearGradient :id="`${id}-lantern`" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#c65b5b" />
          <stop offset="0.5" stop-color="#de7c73" />
          <stop offset="1" stop-color="#bd5353" />
        </linearGradient>
        <radialGradient :id="`${id}-moon`" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stop-color="#f7ecd0" />
          <stop offset="0.72" stop-color="#e3c586" />
          <stop offset="1" stop-color="#c39d58" />
        </radialGradient>
        <g :id="`${id}-cloud`" fill="none" stroke="currentColor" stroke-width="1.2">
          <path d="M0 29h52c18 0 18-19 5-19-7 0-10 5-8 9M9 23h20C15 8 37-4 44 8c6-13 27-7 25 5 14-3 20 16 4 16H61M18 35h57" />
        </g>
        <path :id="`${id}-star`" d="m0-10 2.5 7.5L10 0 2.5 2.5 0 10-2.5 2.5-10 0-2.5-2.5Z" fill="currentColor" />
        <g :id="`${id}-burst`" fill="none" stroke="currentColor" stroke-linecap="round">
          <path
            v-for="angle in [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]"
            :key="angle"
            d="M0-15v-18m0-7v-3"
            :transform="`rotate(${angle})`"
          />
          <circle r="6" stroke-width="0.9" />
        </g>
        <g :id="`${id}-wheat`" fill="currentColor">
          <path d="M0 0Q-6-30 0-78" fill="none" stroke="currentColor" stroke-width="2" />
          <path d="M-2-16c-15-1-19-11-17-17 10 1 16 8 17 17Zm0-17c-15-3-18-12-15-18 10 3 15 10 15 18Zm1-16c-12-4-14-14-10-19 8 4 12 12 10 19ZM0-20c15-3 19-13 16-19-10 3-15 11-16 19Zm0-17c14-4 17-14 13-20C3-53-1-44 0-37Zm1-17c11-5 13-15 9-20C2-69-1-61 1-54Zm0-16c-6-7-4-16 1-21 6 7 5 15-1 21Z" />
        </g>
        <g :id="`${id}-flower`" fill="currentColor">
          <path d="M0 0C-18-14-4-22 0-7 4-22 18-14 6-3 24-3 20 14 5 5 9 24-9 24-5 5-20 14-24-3-6-3Z" />
          <circle r="2.3" fill="#9c7a49" />
        </g>
        <pattern :id="`${id}-pattern`" width="180" height="90" patternUnits="userSpaceOnUse">
          <g v-if="holiday === 'spring' || holiday === 'mid-autumn'">
            <use :href="`#${id}-cloud`" x="6" y="5" />
            <use :href="`#${id}-cloud`" x="100" y="49" />
            <circle v-if="holiday === 'mid-autumn'" cx="137" cy="19" r="1.5" fill="currentColor" />
          </g>
          <g v-else-if="holiday === 'new-year' || holiday === 'national-day'">
            <use :href="`#${id}-star`" transform="translate(22 24) scale(.45)" />
            <use :href="`#${id}-star`" transform="translate(124 66) scale(.28)" />
            <path d="m80 8 10 11-5 11m69-18 4 8m-106 43 8-4" fill="none" stroke="currentColor" />
            <circle cx="161" cy="45" r="1.5" fill="currentColor" />
          </g>
          <g v-else-if="holiday === 'labor'" fill="none" stroke="currentColor">
            <path d="m0 90 90-90 90 90M30 90 90 30l60 60M65 90l25-25 25 25" />
            <use :href="`#${id}-wheat`" transform="translate(9 53) scale(.32) rotate(24)" />
          </g>
          <g v-else-if="holiday === 'dragon-boat'" fill="none" stroke="currentColor">
            <path d="M-45 20q22-16 45 0t45 0 45 0 45 0 45 0M-45 31q22-16 45 0t45 0 45 0 45 0 45 0M-20 68q22-16 45 0t45 0 45 0 45 0 45 0" />
          </g>
          <g v-else-if="holiday === 'qingming'" fill="none" stroke="currentColor">
            <path d="m20 8-9 18m46 19-8 17m49-51-9 18m47 20-9 18m39-59-9 18" />
            <path d="M-20 88 29 65l30 12 45-30 77 41" stroke-width="0.7" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" :fill="`url(#${id}-pattern)`" />
    </svg>

    <svg class="holiday-backdrop__scene" viewBox="0 0 480 120" preserveAspectRatio="xMaxYMid meet" fill="none" focusable="false">
      <!-- Spring Festival: soft vermilion lanterns and cut-paper rosette. -->
      <g v-if="holiday === 'spring'">
        <use :href="`#${id}-cloud`" transform="translate(16 68) scale(1.2)" opacity=".45" />
        <use :href="`#${id}-cloud`" transform="translate(328 76) scale(1.05)" opacity=".5" />
        <g transform="translate(152 54)" stroke="#c77e5b" opacity=".55">
          <path d="m0-34 34 34L0 34-34 0Z" />
          <path
            v-for="angle in [0, 45, 90, 135, 180, 225, 270, 315]"
            :key="angle"
            d="M0-26 6-16 0-6-6-16ZM0-34v8"
            :transform="`rotate(${angle})`"
          />
          <path d="m0-8 8 8L0 8-8 0Z" fill="#c77e5b" />
        </g>
        <g
          v-for="lantern in [{ x: 255, y: 0, scale: 0.85 }, { x: 374, y: -12, scale: 0.68 }]"
          :key="lantern.x"
          :transform="`translate(${lantern.x} ${lantern.y}) scale(${lantern.scale})`"
        >
          <path d="M0 0v18" stroke="#c99c63" />
          <ellipse cy="44" rx="31" ry="25" :fill="`url(#${id}-lantern)`" stroke="#d4a56a" stroke-width="1.4" />
          <ellipse cy="44" rx="13" ry="25" stroke="#f0d3a2" opacity=".55" />
          <path d="M0 19v50M-27 44h54" stroke="#f0d3a2" opacity=".5" />
          <path d="M-11 19h22M-11 69h22" stroke="#c99c63" stroke-width="4.5" />
          <path d="M0 72v10m-5 0v16m5-16v20m5-20v16" stroke="#c97f6d" stroke-width="1.8" />
        </g>
      </g>

      <!-- National Day: soft crimson-gold ribbon, ceremonial column and firework. -->
      <g v-else-if="holiday === 'national-day'">
        <use :href="`#${id}-burst`" transform="translate(148 42) scale(.75)" stroke-width="1.4" opacity=".6" />
        <use :href="`#${id}-burst`" transform="translate(395 28) scale(.5)" opacity=".55" />
        <path d="M64 118C144 45 256 125 358 60c54-35 83-33 136-28v15c-59-7-81 2-128 31-108 66-200-13-282 40Z" :fill="`url(#${id}-gold)`" opacity=".38" />
        <path d="M78 117c87-58 178 9 284-50" stroke="#c86b6b" opacity=".4" />
        <g transform="translate(278 6)" :fill="`url(#${id}-gold)`" opacity=".88">
          <path d="M-11 90h22v7h-22Zm-7 8h36v6h-36ZM-7 27H7v63H-7Zm-6-5h26v6h-26ZM-1.5 4h3v14h-3Z" />
          <path d="M-25 19c8-10 14 3 23-4 11 7 16-6 27 4-8-2-11 8-22 2-11 6-15-4-28-2ZM-7 5.5c-1.5-6 5-8 7.5-3 7-4 13 3 4 5.5L0 13Z" />
          <path d="m-5.5 35 11 7-11 9 11 9-11 9 11 9-11 9" stroke="#b9675a" stroke-width="1.6" />
        </g>
        <path d="m206 14 3 8.5h9l-7.2 5.2 2.8 8.5-7.6-5.2-7.6 5.2 2.8-8.5-7.2-5.2h9Z" fill="#d3a358" opacity=".75" />
      </g>

      <!-- Mid-Autumn: warm pale moon, jade rabbit and osmanthus branch. -->
      <g v-else-if="holiday === 'mid-autumn'">
        <circle cx="275" cy="54" r="52" fill="#d9be83" opacity=".12" />
        <circle cx="275" cy="54" r="44" stroke="#c9ac71" opacity=".25" />
        <circle cx="275" cy="54" r="37" :fill="`url(#${id}-moon)`" opacity=".88" />
        <g fill="#9e7f48" opacity=".16">
          <circle cx="261" cy="41" r="8" />
          <circle cx="291" cy="58" r="10" />
          <circle cx="266" cy="75" r="5.5" />
        </g>
        <use :href="`#${id}-cloud`" transform="translate(152 68) scale(.95)" opacity=".5" />
        <use :href="`#${id}-cloud`" transform="translate(306 78) scale(1.1)" opacity=".45" />
        <g transform="translate(205 90)" fill="#cfa968" opacity=".88">
          <ellipse cx="0" cy="0" rx="17" ry="11" />
          <circle cx="14" cy="-10" r="9" />
          <ellipse cx="12" cy="-25" rx="3.8" ry="12" transform="rotate(-13 12 -25)" />
          <ellipse cx="19" cy="-24" rx="3.4" ry="11" transform="rotate(12 19 -24)" />
          <circle cx="-17" cy="-3" r="5" />
          <circle cx="17" cy="-12" r="1.4" fill="#6b5d7a" />
          <path d="M-9 10h30" stroke="#cfa968" stroke-width="3.2" stroke-linecap="round" />
        </g>
        <path d="M472 0c-32 18-34 55-86 70m65-52-33-2m16 26-7-20m-12 34-33-5" stroke="#b69866" stroke-width="1.8" opacity=".75" />
        <g color="#cda964" opacity=".85">
          <use :href="`#${id}-flower`" transform="translate(412 16) scale(.42)" />
          <use :href="`#${id}-flower`" transform="translate(426 24) scale(.32)" />
          <use :href="`#${id}-flower`" transform="translate(376 52) scale(.4)" />
          <use :href="`#${id}-flower`" transform="translate(389 62) scale(.3)" />
          <use :href="`#${id}-star`" transform="translate(148 26) scale(.35)" />
        </g>
      </g>

      <!-- New Year: soft champagne firework bouquet and streamers. -->
      <g v-else-if="holiday === 'new-year'">
        <use :href="`#${id}-burst`" transform="translate(272 52) scale(.95)" stroke-width="1.6" opacity=".68" />
        <use :href="`#${id}-burst`" transform="translate(154 28) scale(.52)" stroke-width="1.5" opacity=".55" />
        <use :href="`#${id}-burst`" transform="translate(394 22) scale(.58)" stroke-width="1.4" opacity=".6" />
        <path d="M348-6c-25 36 36 24 15 56s-49 11-32 42M198-5c-32 25 22 41 0 62" stroke="#d59482" stroke-width="3.2" opacity=".55" />
        <path d="M256 88c-9 10-11 20-9 36m37-36c13 13 14 26 13 42" stroke="#c89f69" opacity=".45" />
        <g color="#c99562" opacity=".75">
          <use :href="`#${id}-star`" transform="translate(348 76) scale(.65)" />
          <use :href="`#${id}-star`" transform="translate(218 82) scale(.4)" />
          <use :href="`#${id}-star`" transform="translate(110 62) scale(.35)" />
          <path d="m408 62 8 3.5-3.5 8.5m-276 26 6-6m244 16 8.5 2.5m-228-36 4 5" stroke="currentColor" stroke-width="2.4" />
        </g>
      </g>

      <!-- Labor Day: soft sunrise rays and wheat stalks. -->
      <g v-else-if="holiday === 'labor'">
        <g transform="translate(292 104)" stroke="#cda35a" opacity=".28">
          <path
            v-for="angle in [-80, -60, -40, -20, 0, 20, 40, 60, 80]"
            :key="angle"
            d="M0-50v-52"
            :transform="`rotate(${angle})`"
            stroke-width="6"
          />
        </g>
        <path d="M242 104a50 50 0 0 1 100 0" :fill="`url(#${id}-gold)`" opacity=".55" />
        <path d="M126 108h316m-280 8h244" stroke="#c8a263" opacity=".35" />
        <g :fill="`url(#${id}-gold)`" color="#be924a" opacity=".82">
          <use :href="`#${id}-wheat`" transform="translate(198 118) rotate(-24) scale(1.02)" />
          <use :href="`#${id}-wheat`" transform="translate(372 119) rotate(22) scale(1.16)" />
          <use :href="`#${id}-wheat`" transform="translate(404 123) rotate(38) scale(.78)" opacity=".55" />
        </g>
      </g>

      <!-- Dragon Boat Festival: soft indigo water ripples, dragon boat and zongzi. -->
      <g v-else-if="holiday === 'dragon-boat'">
        <path d="M96 102q28-13 56 0t56 0 56 0 56 0 56 0 56 0M116 113q28-13 56 0t56 0 56 0 56 0 56 0" stroke="#6f8cb3" opacity=".45" />
        <g :fill="`url(#${id}-gold)`" opacity=".88">
          <path d="M158 75c38 10 124 12 194-2l16-21 10 4-12 31c-60 20-152 17-194 3Z" />
          <path d="m348 73 6-22-8-8 15-3 5-14 8 9 19-1-7 9 10 4-6 7-14-4-6 26Z" />
          <path d="m357 31-7-13 14 7m16 10 11-12-2 15" stroke="#c79e54" stroke-width="2.5" stroke-linejoin="round" />
        </g>
        <circle cx="373" cy="40" r="2.2" fill="#465f87" />
        <path d="m361 59-10-4m11 11-12-4" stroke="#465f87" stroke-width="1.8" />
        <g stroke="#c79e54" stroke-width="2.5" stroke-linecap="round" opacity=".85">
          <path v-for="x in [200, 232, 264, 296]" :key="x" :d="`M${x} 61l-15 35m-3 3 6-8`" />
        </g>
        <g transform="translate(122 22) rotate(-12)" opacity=".85">
          <path d="M0 2c3-5 7-5 10 0l27 42c3 5 1 8-5 8h-53c-6 0-8-3-4-8Z" fill="#6d84a9" stroke="#c9a55e" stroke-width="1.4" />
          <path d="m4 2-6 50m-23-9 55-14M-17 30l49 18" stroke="#d9bc7a" stroke-width="1.6" />
          <path d="M-2 33c-15-16-17 3 0 0 15-18 20 2 0 0Zm0 0-8 19m8-19 11 18" stroke="#e5cc8d" stroke-width="1.3" />
        </g>
        <use :href="`#${id}-cloud`" transform="translate(232 6) scale(.72)" opacity=".38" />
      </g>

      <!-- Qingming: misty ink-wash hills, slanted rain and blue-grey willow. -->
      <g v-else-if="holiday === 'qingming'">
        <path d="m0 120 77-46 34 11 65-46 49 26 38-12 59 39 56-32 102 60Z" fill="#8ea4ba" opacity=".28" />
        <path d="m47 120 104-39 51 14 78-30 64 34 47-10 89 31Z" fill="#5e768f" opacity=".28" />
        <path d="M29 109q94-14 166-2t161-3 124 2" stroke="#7c96b0" opacity=".32" />
        <circle cx="216" cy="34" r="18" fill="#9fb5ca" opacity=".28" />
        <path d="M480 0c-54 3-106 6-156 29m43-14c-33 20-30 34-42 54m70-60c-22 24-17 46-27 71m60-75c-14 27-6 40-12 58m40-60c-5 24 7 39 0 58" stroke="#7089a3" stroke-width="1.3" opacity=".75" />
        <g fill="#7c95ae" opacity=".68">
          <path d="M353 23q-18-1-15 13 9-2 15-13Zm-15 19q-16 0-12 12 8-1 12-12Zm-10 18q-13 1-9 13 7-3 9-13Zm59-39q-15 1-12 13 9-3 12-13Zm-9 19q11 6 2 15-7-6-2-15Zm-8 20q-14 1-10 14 8-3 10-14Zm53-46q-14 2-10 14 9-4 10-14Zm-5 21q11 5 4 16-8-5-4-16Zm35-19q-13 4-7 15 7-4 7-15Zm3 22q12 4 7 14-9-4-7-14Z" />
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.holiday-backdrop {
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 86% 20%, var(--holiday-glow), transparent 62%),
    linear-gradient(108deg, var(--holiday-tint-left) 0%, transparent 48%, var(--holiday-tint-right) 100%);
  color: var(--holiday-pattern);
  pointer-events: none;
  user-select: none;
}

.holiday-backdrop--spring {
  --holiday-tint-left: rgb(198 86 78 / 10%);
  --holiday-tint-right: rgb(214 152 78 / 15%);
  --holiday-glow: rgb(212 96 84 / 16%);
  --holiday-pattern: #b5685a;
}

.holiday-backdrop--national-day {
  --holiday-tint-left: rgb(194 78 78 / 9%);
  --holiday-tint-right: rgb(212 162 82 / 14%);
  --holiday-glow: rgb(206 102 88 / 15%);
  --holiday-pattern: #b26d5c;
}

.holiday-backdrop--mid-autumn {
  --holiday-tint-left: rgb(92 108 156 / 10%);
  --holiday-tint-right: rgb(212 174 96 / 15%);
  --holiday-glow: rgb(216 184 110 / 16%);
  --holiday-pattern: #7f86a8;
}

.holiday-backdrop--new-year {
  --holiday-tint-left: rgb(188 94 114 / 9%);
  --holiday-tint-right: rgb(218 168 106 / 14%);
  --holiday-glow: rgb(212 128 124 / 15%);
  --holiday-pattern: #ab747b;
}

.holiday-backdrop--labor {
  --holiday-tint-left: rgb(186 132 68 / 9%);
  --holiday-tint-right: rgb(214 166 84 / 15%);
  --holiday-glow: rgb(214 162 78 / 16%);
  --holiday-pattern: #a8864c;
}

.holiday-backdrop--dragon-boat {
  --holiday-tint-left: rgb(82 114 162 / 10%);
  --holiday-tint-right: rgb(202 162 86 / 14%);
  --holiday-glow: rgb(104 138 184 / 15%);
  --holiday-pattern: #6c83a6;
}

.holiday-backdrop--qingming {
  --holiday-tint-left: rgb(108 134 162 / 10%);
  --holiday-tint-right: rgb(138 164 188 / 15%);
  --holiday-glow: rgb(132 160 186 / 16%);
  --holiday-pattern: #6f869c;
}

.holiday-backdrop__pattern {
  position: absolute;
  inset: 0;
  opacity: 0.085;
}

.holiday-backdrop__scene {
  position: absolute;
  top: 0;
  right: max(0px, calc((100% - var(--workspace-width)) / 2));
  width: 28rem;
  height: 100%;
  opacity: 0.72;
}

:root[data-theme='dark'] .holiday-backdrop--spring {
  --holiday-tint-left: rgb(198 86 78 / 14%);
  --holiday-tint-right: rgb(214 152 78 / 18%);
  --holiday-glow: rgb(212 96 84 / 18%);
  --holiday-pattern: #d49689;
}

:root[data-theme='dark'] .holiday-backdrop--national-day {
  --holiday-tint-left: rgb(194 78 78 / 14%);
  --holiday-tint-right: rgb(212 162 82 / 18%);
  --holiday-glow: rgb(206 102 88 / 18%);
  --holiday-pattern: #d39a86;
}

:root[data-theme='dark'] .holiday-backdrop--mid-autumn {
  --holiday-tint-left: rgb(92 108 156 / 16%);
  --holiday-tint-right: rgb(212 174 96 / 16%);
  --holiday-glow: rgb(216 184 110 / 16%);
  --holiday-pattern: #a7b0cf;
}

:root[data-theme='dark'] .holiday-backdrop--new-year {
  --holiday-tint-left: rgb(188 94 114 / 14%);
  --holiday-tint-right: rgb(218 168 106 / 16%);
  --holiday-glow: rgb(212 128 124 / 17%);
  --holiday-pattern: #cda0a4;
}

:root[data-theme='dark'] .holiday-backdrop--labor {
  --holiday-tint-left: rgb(186 132 68 / 14%);
  --holiday-tint-right: rgb(214 166 84 / 17%);
  --holiday-glow: rgb(214 162 78 / 17%);
  --holiday-pattern: #c8ab76;
}

:root[data-theme='dark'] .holiday-backdrop--dragon-boat {
  --holiday-tint-left: rgb(82 114 162 / 16%);
  --holiday-tint-right: rgb(202 162 86 / 15%);
  --holiday-glow: rgb(104 138 184 / 17%);
  --holiday-pattern: #9bb1d1;
}

:root[data-theme='dark'] .holiday-backdrop--qingming {
  --holiday-tint-left: rgb(108 134 162 / 16%);
  --holiday-tint-right: rgb(138 164 188 / 16%);
  --holiday-glow: rgb(132 160 186 / 18%);
  --holiday-pattern: #9cb4ca;
}

:root[data-theme='dark'] .holiday-backdrop__pattern {
  opacity: 0.11;
}

:root[data-theme='dark'] .holiday-backdrop__scene {
  opacity: 0.65;
}

@media (min-width: 600px) and (max-width: 1279px) {
  .holiday-backdrop__scene {
    right: -0.5rem;
    width: 22rem;
    opacity: 0.6;
  }
}

@media (max-width: 599px) {
  .holiday-backdrop__scene {
    right: -0.5rem;
    width: 15.5rem;
    opacity: 0.5;
  }

  .holiday-backdrop__pattern {
    opacity: 0.065;
  }
}
</style>
