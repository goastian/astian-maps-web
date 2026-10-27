import {
  Bed,
  Bank,
  BatteryCharging,
  Bicycle,
  Books,
  Bus,
  Coffee,
  FirstAid,
  ForkKnife,
  GasPump,
  GraduationCap,
  Pill,
  MapPin,
  Mountains,
  ShoppingBag,
  ShoppingCart,
  Tree,
  type Icon,
} from "@phosphor-icons/react";

interface CategoryStyle {
  icon: Icon;
  hue: number;
}

const categoryStyles: Array<[RegExp, CategoryStyle]> = [
  [/restaurant|food_court|fast_food|biergarten|pub|bar\b/, { icon: ForkKnife, hue: 22 }],
  [/cafe|coffee|bakery|ice_cream/, { icon: Coffee, hue: 32 }],
  [/groceries|supermarket|convenience|greengrocer|marketplace/, { icon: ShoppingCart, hue: 142 }],
  [/shop|store|mall|clothes|retail|department/, { icon: ShoppingBag, hue: 290 }],
  [/pharmacy|chemist/, { icon: Pill, hue: 168 }],
  [/hospital|clinic|doctor|dentist|health/, { icon: FirstAid, hue: 2 }],
  [/hotel|hostel|guest|motel|apartment|lodging/, { icon: Bed, hue: 262 }],
  [/fuel|gas/, { icon: GasPump, hue: 212 }],
  [/charging/, { icon: BatteryCharging, hue: 188 }],
  [/park|garden|forest|nature|wood/, { icon: Tree, hue: 130 }],
  [/bus|station|transit|train|tram|subway|stop/, { icon: Bus, hue: 224 }],
  [/bicycle|bike/, { icon: Bicycle, hue: 160 }],
  [/school|university|college|kindergarten/, { icon: GraduationCap, hue: 250 }],
  [/library|museum|gallery|arts|theatre|cinema/, { icon: Books, hue: 330 }],
  [/bank|atm/, { icon: Bank, hue: 200 }],
  [/peak|viewpoint|mountain|beach/, { icon: Mountains, hue: 100 }],
];

const fallbackStyle: CategoryStyle = { icon: MapPin, hue: 215 };

export function categoryStyle(categoryId: string): CategoryStyle {
  const id = categoryId.toLowerCase();
  return categoryStyles.find(([pattern]) => pattern.test(id))?.[1] ?? fallbackStyle;
}

export function CategoryIcon({
  categoryId,
  size = 20,
  className = "",
}: {
  categoryId: string;
  size?: number;
  className?: string;
}) {
  const { icon: Glyph, hue } = categoryStyle(categoryId);
  return (
    <span
      className={`am-cat-icon ${className}`.trim()}
      style={{ "--cat-hue": hue } as React.CSSProperties}
      aria-hidden="true"
    >
      <Glyph size={size} weight="fill" />
    </span>
  );
}
