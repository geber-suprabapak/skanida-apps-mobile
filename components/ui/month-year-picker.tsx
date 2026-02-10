import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  useWindowDimensions,
  Animated,
  Easing,
} from "react-native";
import { Text } from "~/components/ui/text";
import { Icon } from "~/components/ui/icon";
import { timeSync } from "~/utils/timeSync";
import {
  Clock,
  History,
  CheckCircle,
  Calendar,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  MousePointerClick,
} from "lucide-react-native";

export interface MonthYearPickerProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  isDarkColorScheme?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
  buttonStyle?: string;
  textStyle?: string;
}

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const ITEM_HEIGHT = 50;

const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  selectedDate,
  onDateChange,
  isDarkColorScheme = false,
  minimumDate,
  maximumDate = timeSync.getSyncedTime(),
  buttonStyle,
  textStyle,
}) => {
  // PERF-L01: Use hook instead of module-scope Dimensions.get
  const { width: screenWidth } = useWindowDimensions();

  const [showPicker, setShowPicker] = useState(false);
  const [tempYear, setTempYear] = useState(selectedDate.getFullYear());
  const [tempMonth, setTempMonth] = useState(selectedDate.getMonth());

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const monthScrollRef = useRef<ScrollView>(null);
  const yearScrollRef = useRef<ScrollView>(null);

  // Generate year range
  const currentYear = timeSync.getSyncedTime().getFullYear();
  const startYear = minimumDate ? minimumDate.getFullYear() : currentYear - 10;
  const endYear = maximumDate ? maximumDate.getFullYear() : currentYear + 5;
  // PERF-L02: Memoize years array to avoid recreating on each render
  const years = useMemo(
    () =>
      Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i),
    [startYear, endYear],
  );

  // Auto-scroll to selected items when picker opens
  useEffect(() => {
    if (showPicker) {
      // Small delay to ensure the ScrollViews are rendered
      setTimeout(() => {
        // Calculate proper centering for month
        const monthIndex = tempMonth;
        const itemWithSpacing = ITEM_HEIGHT + 8; // Item height + marginVertical
        const visibleAreaHeight = ITEM_HEIGHT * 5;
        const centerOffset = (visibleAreaHeight - ITEM_HEIGHT) / 2;

        // Calculate scroll position to center the selected month
        let monthOffset = monthIndex * itemWithSpacing - centerOffset;
        monthOffset = Math.max(0, monthOffset);

        monthScrollRef.current?.scrollTo({ y: monthOffset, animated: true });

        // Calculate proper centering for year
        const yearIndex = years.indexOf(tempYear);
        if (yearIndex !== -1) {
          // Calculate scroll position to center the selected year
          let yearOffset = yearIndex * itemWithSpacing - centerOffset;
          yearOffset = Math.max(0, yearOffset);

          yearScrollRef.current?.scrollTo({ y: yearOffset, animated: true });
        }
      }, 200);
    }
  }, [showPicker, tempMonth, tempYear, years]);

  const openPicker = () => {
    setTempYear(selectedDate.getFullYear());
    setTempMonth(selectedDate.getMonth());
    setShowPicker(true);

    // Start entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closePicker = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowPicker(false);
    });
  };

  const handleConfirm = () => {
    const newDate = new Date(tempYear, tempMonth, 1);
    onDateChange(newDate);
    closePicker();
  };

  const handleCancel = () => {
    setTempYear(selectedDate.getFullYear());
    setTempMonth(selectedDate.getMonth());
    closePicker();
  };

  const isDateInRange = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    if (
      minimumDate &&
      date < new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1)
    ) {
      return false;
    }
    if (
      maximumDate &&
      date > new Date(maximumDate.getFullYear(), maximumDate.getMonth(), 1)
    ) {
      return false;
    }
    return true;
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const currentDate = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      1,
    );
    const newDate = new Date(currentDate);

    if (direction === "prev") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }

    if (isDateInRange(newDate.getFullYear(), newDate.getMonth())) {
      onDateChange(newDate);
    }
  };

  const canNavigatePrev = () => {
    if (!minimumDate) return true;
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();
    const minMonth = minimumDate.getMonth();
    const minYear = minimumDate.getFullYear();

    return (
      currentYear > minYear ||
      (currentYear === minYear && currentMonth > minMonth)
    );
  };

  const canNavigateNext = () => {
    if (!maximumDate) return true;
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();
    const maxMonth = maximumDate.getMonth();
    const maxYear = maximumDate.getFullYear();

    return (
      currentYear < maxYear ||
      (currentYear === maxYear && currentMonth < maxMonth)
    );
  };

  const formatDisplayDate = () => {
    return `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  };

  const renderPickerItem = (
    item: string | number,
    index: number,
    isSelected: boolean,
    onPress: () => void,
    isDisabled: boolean = false,
    itemType: "month" | "year" = "month",
  ) => {
    const getIcon = () => {
      if (!isSelected) return null;

      switch (itemType) {
        case "month":
          return <Icon as={Clock} className="size-4 text-white mr-2" />;
        case "year":
          return <Icon as={History} className="size-4 text-white mr-2" />;
        default:
          return <Icon as={CheckCircle} className="size-4 text-white mr-2" />;
      }
    };

    return (
      <TouchableOpacity
        key={`${item}-${index}`}
        onPress={isDisabled ? undefined : onPress}
        disabled={isDisabled}
        style={{
          height: ITEM_HEIGHT,
          justifyContent: "center",
          alignItems: "center",
          marginHorizontal: 8,
          marginVertical: 4,
          borderRadius: 12,
          backgroundColor: isSelected
            ? isDarkColorScheme
              ? "#2563EB"
              : "#3B82F6"
            : isDarkColorScheme
              ? "#374151"
              : "#F3F4F6",
          opacity: isDisabled ? 0.4 : 1,
          shadowColor: isSelected ? "#3B82F6" : "#000000",
          shadowOffset: { width: 0, height: isSelected ? 4 : 2 },
          shadowOpacity: isSelected ? 0.3 : 0.1,
          shadowRadius: isSelected ? 8 : 4,
          elevation: isSelected ? 8 : 2,
        }}
      >
        <View className="flex-row items-center">
          {getIcon()}
          <Text
            className={`
              font-semibold text-base
              ${
                isSelected
                  ? "text-white"
                  : isDarkColorScheme
                    ? isDisabled
                      ? "text-gray-500"
                      : "text-white"
                    : isDisabled
                      ? "text-gray-400"
                      : "text-gray-900"
              }
            `}
          >
            {item}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      {/* Date Display Button */}
      <View className="flex-row items-center">
        <TouchableOpacity
          onPress={() => navigateMonth("prev")}
          disabled={!canNavigatePrev()}
          className={`
            p-3 rounded-full mr-3
            ${
              canNavigatePrev()
                ? isDarkColorScheme
                  ? "bg-gray-700"
                  : "bg-gray-100"
                : "opacity-30"
            }
          `}
          style={{
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Icon
            as={ChevronLeft}
            className={`size-5 ${
              isDarkColorScheme ? "text-white" : "text-black"
            }`}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={openPicker}
          className={`
            flex-1 flex-row items-center justify-between p-4 rounded-xl
            ${isDarkColorScheme ? "bg-gray-700" : "bg-gray-50"}
            ${buttonStyle || ""}
          `}
          style={{
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 3,
          }}
        >
          <View className="flex-row items-center">
            <Icon
              as={Calendar}
              className={`size-5 mr-3 ${
                isDarkColorScheme ? "text-white" : "text-black"
              }`}
            />
            <Text
              className={`
                text-base font-semibold
                ${isDarkColorScheme ? "text-white" : "text-gray-900"}
                ${textStyle || ""}
              `}
            >
              {formatDisplayDate()}
            </Text>
          </View>
          <Icon
            as={ChevronDown}
            className={`size-5 ${
              isDarkColorScheme ? "text-white" : "text-black"
            }`}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigateMonth("next")}
          disabled={!canNavigateNext()}
          className={`
            p-3 rounded-full ml-3
            ${
              canNavigateNext()
                ? isDarkColorScheme
                  ? "bg-gray-700"
                  : "bg-gray-100"
                : "opacity-30"
            }
          `}
          style={{
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Icon
            as={ChevronRight}
            className={`size-5 ${
              isDarkColorScheme ? "text-white" : "text-black"
            }`}
          />
        </TouchableOpacity>
      </View>

      {/* Enhanced Modal Picker */}
      <Modal
        visible={showPicker}
        transparent
        animationType="none"
        onRequestClose={handleCancel}
      >
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            justifyContent: "center",
            alignItems: "center",
            opacity: fadeAnim,
          }}
        >
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            onPress={handleCancel}
            activeOpacity={1}
          />

          <Animated.View
            style={{
              transform: [{ scale: scaleAnim }],
              width: screenWidth * 0.9,
              maxWidth: 400,
            }}
            className={`
              rounded-3xl p-6 mx-4
              ${isDarkColorScheme ? "bg-gray-800" : "bg-white"}
            `}
          >
            {/* Header */}
            <View className="flex-row items-center justify-center mb-6">
              <Icon
                as={MousePointerClick}
                className={`size-6 mr-3 ${
                  isDarkColorScheme ? "text-white" : "text-black"
                }`}
              />
              <Text
                className={`
                  text-xl font-bold
                  ${isDarkColorScheme ? "text-white" : "text-gray-900"}
                `}
              >
                Pilih Bulan & Tahun
              </Text>
            </View>

            {/* Month and Year Selectors */}
            <View className="flex-row">
              {/* Month Selector */}
              <View className="flex-1 mr-4">
                <View className="flex-row items-center justify-center mb-4">
                  <Icon
                    as={Clock}
                    className={`size-4 mr-2 ${
                      isDarkColorScheme ? "text-gray-300" : "text-gray-600"
                    }`}
                  />
                  <Text
                    className={`
                      text-sm font-medium text-center
                      ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}
                    `}
                  >
                    Bulan
                  </Text>
                </View>
                <ScrollView
                  ref={monthScrollRef}
                  style={{ height: ITEM_HEIGHT * 5 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingTop: ITEM_HEIGHT * 2,
                    paddingBottom: ITEM_HEIGHT * 2,
                  }}
                >
                  {MONTHS.map((month, index) => {
                    const isSelected = index === tempMonth;
                    const isDisabled = !isDateInRange(tempYear, index);
                    return renderPickerItem(
                      month,
                      index,
                      isSelected,
                      () => setTempMonth(index),
                      isDisabled,
                      "month",
                    );
                  })}
                </ScrollView>
              </View>

              {/* Year Selector */}
              <View className="flex-1 ml-4">
                <View className="flex-row items-center justify-center mb-4">
                  <Icon
                    as={History}
                    className={`size-4 mr-2 ${
                      isDarkColorScheme ? "text-gray-300" : "text-gray-600"
                    }`}
                  />
                  <Text
                    className={`
                      text-sm font-medium text-center
                      ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}
                    `}
                  >
                    Tahun
                  </Text>
                </View>
                <ScrollView
                  ref={yearScrollRef}
                  style={{ height: ITEM_HEIGHT * 5 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingTop: ITEM_HEIGHT * 2,
                    paddingBottom: ITEM_HEIGHT * 2,
                  }}
                >
                  {years.map((year, index) => {
                    const isSelected = year === tempYear;
                    const isDisabled = !isDateInRange(year, tempMonth);
                    return renderPickerItem(
                      year,
                      index,
                      isSelected,
                      () => setTempYear(year),
                      isDisabled,
                      "year",
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row mt-6 space-x-3">
              <TouchableOpacity
                onPress={handleCancel}
                className={`
                  flex-1 p-4 rounded-xl mr-3
                  ${isDarkColorScheme ? "bg-gray-700" : "bg-gray-200"}
                `}
              >
                <Text
                  className={`
                    text-center font-semibold
                    ${isDarkColorScheme ? "text-gray-300" : "text-gray-700"}
                  `}
                >
                  Batal
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirm}
                className="flex-1 p-4 rounded-xl bg-blue-500 ml-3"
                style={{
                  shadowColor: "#3B82F6",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }}
              >
                <Text className="text-center text-white font-semibold">
                  Pilih
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
};

export default MonthYearPicker;
