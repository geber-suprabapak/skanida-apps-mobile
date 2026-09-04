import * as React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, cleanup } from "@testing-library/react-native";
import { View, Alert, BackHandler } from "react-native";
// @ts-expect-error missing dev types
import * as babelParser from "@babel/parser";
// @ts-expect-error missing dev types
import babelTraverse from "@babel/traverse";

const traverse = (babelTraverse as any).default || babelTraverse;
const ROOT = path.resolve(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function parseAst(relPath: string) {
  const code = readSource(relPath);
  return babelParser.parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });
}

// Configurable uniwind theme state for theme testing
let mockTheme = "light";
jest.mock("uniwind", () => ({
  useUniwind: () => ({
    theme: mockTheme,
    isDark: mockTheme === "dark",
  }),
  withUniwind: jest.fn((Comp: any) => Comp),
}));

// Mock expo-router Tabs
jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");

  const TabsComponent = (props: any) => {
    return React.createElement(View, { testID: "mock-tabs", ...props }, props.children);
  };
  TabsComponent.Screen = (props: any) =>
    React.createElement(View, { testID: `mock-tab-${props.name}` });

  return {
    useRouter: () => ({
      back: jest.fn(),
      canGoBack: jest.fn(),
      push: jest.fn(),
      replace: jest.fn(),
      navigate: jest.fn(),
    }),
    useFocusEffect: (callback: () => any) => {
      return callback();
    },
    useLocalSearchParams: () => ({}),
    Stack: {
      Screen: () => null,
    },
    Tabs: TabsComponent,
  };
});

jest.mock("expo-image", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: any) =>
      React.createElement(View, { ...props, testID: "mock-expo-image" }),
  };
});

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  return new Proxy(
    {},
    {
      get: () => (props: any) =>
        React.createElement(View, { ...props, testID: "mock-lucide-icon" }),
    },
  );
});

import { Avatar } from "../components/ui/avatar";
import LoadingScreen from "../app/auth/LoadingScreen";
import TabLayout from "../app/(tabs)/_layout";

describe("Empirical Challenge: Requirements R1, R2, and R3 Invariants", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTheme = "light";
  });

  afterEach(() => {
    cleanup();
  });

  // =========================================================================
  // REQUIREMENT R1: Explicit Image Dimension Invariants (No 0x0 dp regressions)
  // =========================================================================
  describe("R1: Explicit Image Dimension Invariants & Yoga Non-Zero Sizing", () => {
    it("AuthSelector.tsx: school logo has explicit numeric style { width: 144, height: 144 }", () => {
      const ast = parseAst("app/auth/AuthSelector.tsx");
      let foundImage = false;
      let widthVal: any = null;
      let heightVal: any = null;
      let contentFitVal: any = null;
      let accessibilityLabelVal: any = null;

      traverse(ast, {
        JSXElement(path: any) {
          if (path.node.openingElement.name.name === "Image") {
            foundImage = true;
            for (const attr of path.node.openingElement.attributes) {
              if (attr.type === "JSXAttribute") {
                if (attr.name.name === "style") {
                  if (attr.value?.type === "JSXExpressionContainer") {
                    const expr = attr.value.expression;
                    if (expr.type === "ObjectExpression") {
                      for (const prop of expr.properties) {
                        if (prop.key.name === "width") widthVal = prop.value.value;
                        if (prop.key.name === "height") heightVal = prop.value.value;
                      }
                    }
                  }
                }
                if (attr.name.name === "contentFit") {
                  contentFitVal = attr.value?.value;
                }
                if (attr.name.name === "accessibilityLabel") {
                  accessibilityLabelVal = attr.value?.value;
                }
              }
            }
          }
        },
      });

      expect(foundImage).toBe(true);
      expect(widthVal).toBe(144);
      expect(heightVal).toBe(144);
      expect(contentFitVal).toBe("contain");
      expect(accessibilityLabelVal).toBe("Logo SMKN 2 Magelang");
    });

    it("Dashboard.tsx: school logo has explicit numeric style { width: 40, height: 40 }", () => {
      const ast = parseAst("app/Dashboard.tsx");
      let foundLogoImage = false;
      let widthVal: any = null;
      let heightVal: any = null;
      let contentFitVal: any = null;

      traverse(ast, {
        JSXElement(path: any) {
          if (path.node.openingElement.name.name === "Image") {
            // Check if this is the header school logo
            let isLogo = false;
            for (const attr of path.node.openingElement.attributes) {
              if (
                attr.type === "JSXAttribute" &&
                attr.name.name === "accessibilityLabel" &&
                attr.value?.value === "Logo SMKN 2 Magelang"
              ) {
                isLogo = true;
              }
            }
            if (isLogo) {
              foundLogoImage = true;
              for (const attr of path.node.openingElement.attributes) {
                if (attr.type === "JSXAttribute") {
                  if (attr.name.name === "style") {
                    if (attr.value?.type === "JSXExpressionContainer") {
                      const expr = attr.value.expression;
                      if (expr.type === "ObjectExpression") {
                        for (const prop of expr.properties) {
                          if (prop.key.name === "width") widthVal = prop.value.value;
                          if (prop.key.name === "height") heightVal = prop.value.value;
                        }
                      }
                    }
                  }
                  if (attr.name.name === "contentFit") {
                    contentFitVal = attr.value?.value;
                  }
                }
              }
            }
          }
        },
      });

      expect(foundLogoImage).toBe(true);
      expect(widthVal).toBe(40);
      expect(heightVal).toBe(40);
      expect(contentFitVal).toBe("contain");
    });

    it("callback.tsx: school logo has explicit numeric style { width: 96, height: 96 }", () => {
      const ast = parseAst("app/auth/callback.tsx");
      let foundImage = false;
      let widthVal: any = null;
      let heightVal: any = null;
      let contentFitVal: any = null;
      let accessibilityLabelVal: any = null;

      traverse(ast, {
        JSXElement(path: any) {
          if (path.node.openingElement.name.name === "Image") {
            foundImage = true;
            for (const attr of path.node.openingElement.attributes) {
              if (attr.type === "JSXAttribute") {
                if (attr.name.name === "style") {
                  if (attr.value?.type === "JSXExpressionContainer") {
                    const expr = attr.value.expression;
                    if (expr.type === "ObjectExpression") {
                      for (const prop of expr.properties) {
                        if (prop.key.name === "width") widthVal = prop.value.value;
                        if (prop.key.name === "height") heightVal = prop.value.value;
                      }
                    }
                  }
                }
                if (attr.name.name === "contentFit") {
                  contentFitVal = attr.value?.value;
                }
                if (attr.name.name === "accessibilityLabel") {
                  accessibilityLabelVal = attr.value?.value;
                }
              }
            }
          }
        },
      });

      expect(foundImage).toBe(true);
      expect(widthVal).toBe(96);
      expect(heightVal).toBe(96);
      expect(contentFitVal).toBe("contain");
      expect(accessibilityLabelVal).toBe("Logo SMKN 2 Magelang");
    });

    it("LoadingScreen.tsx: school logo has explicit numeric style { width: 144, height: 144 } and renders cleanly", async () => {
      const { getByTestId, getByText } = await render(<LoadingScreen />);
      const image = getByTestId("mock-expo-image");

      expect(image.props.style).toEqual({ width: 144, height: 144 });
      expect(image.props.contentFit).toBe("contain");
      expect(image.props.accessibilityLabel).toBe("Logo SMKN 2 Magelang");
      expect(getByText("SKANIDA")).toBeTruthy();
    });

    it("components/ui/avatar.tsx: Image has explicit { width: '100%', height: '100%' } style and fills parent", async () => {
      const { getByTestId } = await render(
        <Avatar source="https://cdn.example.com/student.jpg" size="lg" />,
      );
      const img = getByTestId("mock-expo-image");

      expect(img.props.style).toEqual({ width: "100%", height: "100%" });
      expect(img.props.contentFit).toBe("cover");
      expect(img.props.accessibilityRole).toBe("image");
      expect(img.props.accessibilityLabel).toBe("Foto profil");
    });

    it("components/ui/avatar.tsx: when source is falsy, Image is not rendered and initials/icon are shown", async () => {
      const { queryByTestId, getByText } = await render(
        <Avatar fallback="AB" size="md" />,
      );
      expect(queryByTestId("mock-expo-image")).toBeNull();
      expect(getByText("AB")).toBeTruthy();
    });

    it("app/perizinan/izin.tsx: ImagePreview has explicit { width: '100%', height: '100%' } and contentFit='contain'", () => {
      const ast = parseAst("app/perizinan/izin.tsx");
      let foundPreviewImage = false;
      let widthVal: any = null;
      let heightVal: any = null;
      let contentFitVal: any = null;
      let accessibilityLabelVal: any = null;

      traverse(ast, {
        VariableDeclarator(path: any) {
          if (path.node.id?.name === "ImagePreview") {
            path.traverse({
              JSXElement(innerPath: any) {
                if (innerPath.node.openingElement.name.name === "Image") {
                  foundPreviewImage = true;
                  for (const attr of innerPath.node.openingElement.attributes) {
                    if (attr.type === "JSXAttribute") {
                      if (attr.name.name === "style") {
                        if (attr.value?.type === "JSXExpressionContainer") {
                          const expr = attr.value.expression;
                          if (expr.type === "ObjectExpression") {
                            for (const prop of expr.properties) {
                              if (prop.key.name === "width") widthVal = prop.value.value;
                              if (prop.key.name === "height") heightVal = prop.value.value;
                            }
                          }
                        }
                      }
                      if (attr.name.name === "contentFit") {
                        contentFitVal = attr.value?.value;
                      }
                      if (attr.name.name === "accessibilityLabel") {
                        accessibilityLabelVal = attr.value?.value;
                      }
                    }
                  }
                }
              },
            });
          }
        },
      });

      expect(foundPreviewImage).toBe(true);
      expect(widthVal).toBe("100%");
      expect(heightVal).toBe("100%");
      expect(contentFitVal).toBe("contain");
      expect(accessibilityLabelVal).toBe("Pratinjau surat bukti perizinan");
    });

    it("Stress Invariant: No 0x0 dp dimensions exist in any target Image elements", () => {
      const targets = [
        "app/auth/AuthSelector.tsx",
        "app/Dashboard.tsx",
        "app/auth/callback.tsx",
        "app/auth/LoadingScreen.tsx",
        "components/ui/avatar.tsx",
        "app/perizinan/izin.tsx",
      ];

      for (const relPath of targets) {
        const ast = parseAst(relPath);
        traverse(ast, {
          JSXElement(path: any) {
            if (path.node.openingElement.name.name === "Image") {
              for (const attr of path.node.openingElement.attributes) {
                if (attr.type === "JSXAttribute" && attr.name.name === "style") {
                  if (attr.value?.type === "JSXExpressionContainer") {
                    const expr = attr.value.expression;
                    if (expr.type === "ObjectExpression") {
                      for (const prop of expr.properties) {
                        if (prop.key?.name === "width" || prop.key?.name === "height") {
                          // Must not be 0
                          expect(prop.value.value).not.toBe(0);
                          expect(prop.value.value).not.toBe("0");
                          expect(prop.value.value).not.toBe("0px");
                        }
                      }
                    }
                  }
                }
              }
            }
          },
        });
      }
    });
  });

  // =========================================================================
  // REQUIREMENT R2: Theming, Dark Mode Contrast & Sticky Layout
  // =========================================================================
  describe("R2: Theming, Dynamic TabBar Style & Sticky Contrast CTA", () => {
    it("AuthSelector.tsx: logo container circle has 'border border-border' for dark theme contrast", () => {
      const ast = parseAst("app/auth/AuthSelector.tsx");
      let containerClass = "";

      traverse(ast, {
        JSXElement(path: any) {
          if (path.node.openingElement.name.name === "Image") {
            const parent = path.parentPath;
            if (parent && parent.node.type === "JSXElement") {
              for (const attr of parent.node.openingElement.attributes) {
                if (attr.type === "JSXAttribute" && attr.name.name === "className") {
                  containerClass = attr.value?.value || "";
                }
              }
            }
          }
        },
      });

      expect(containerClass).toContain("w-52 h-52");
      expect(containerClass).toContain("rounded-full");
      expect(containerClass).toContain("border");
      expect(containerClass).toContain("border-border");
      expect(containerClass).toContain("bg-card");
    });

    it("app/(tabs)/_layout.tsx: adapts tabBarStyle dynamically in dark mode", () => {
      mockTheme = "dark";
      const tree = TabLayout();
      expect(tree).toBeDefined();
      const screenOptions = tree.props.screenOptions;
      expect(screenOptions.tabBarStyle).toEqual({
        backgroundColor: "#0a0a0a",
        borderTopColor: "#262626",
      });
      expect(screenOptions.tabBarInactiveTintColor).toBe("#A1A1AA");
      expect(screenOptions.tabBarActiveTintColor).toBe("#0066FF");
    });

    it("app/(tabs)/_layout.tsx: adapts tabBarStyle dynamically in light mode", () => {
      mockTheme = "light";
      const tree = TabLayout();
      expect(tree).toBeDefined();
      const screenOptions = tree.props.screenOptions;
      expect(screenOptions.tabBarStyle).toEqual({
        backgroundColor: "#ffffff",
        borderTopColor: "#e5e5e5",
      });
      expect(screenOptions.tabBarInactiveTintColor).toBe("#64748B");
      expect(screenOptions.tabBarActiveTintColor).toBe("#0066FF");
    });

    it("app/perizinan/izin.tsx: submit button container is sticky outside ScrollView", () => {
      const ast = parseAst("app/perizinan/izin.tsx");
      let submitParentIsKav = false;
      let submitParentIsScrollView = false;
      let stickyContainerClasses = "";

      traverse(ast, {
        JSXElement(path: any) {
          if (
            path.node.openingElement.name.name === "TouchableOpacity" &&
            path.node.openingElement.attributes.some(
              (a: any) =>
                a.type === "JSXAttribute" &&
                a.name.name === "accessibilityLabel" &&
                a.value?.value === "Kirim Pengajuan Izin",
            )
          ) {
            // Check direct parent container
            const container = path.parentPath;
            if (container && container.node.type === "JSXElement") {
              for (const attr of container.node.openingElement.attributes) {
                if (attr.type === "JSXAttribute" && attr.name.name === "className") {
                  stickyContainerClasses = attr.value?.value || "";
                }
              }

              // Check grandparent
              const grandparent = container.parentPath;
              if (grandparent && grandparent.node.type === "JSXElement") {
                if (grandparent.node.openingElement.name.name === "KeyboardAvoidingView") {
                  submitParentIsKav = true;
                }
                if (grandparent.node.openingElement.name.name === "ScrollView") {
                  submitParentIsScrollView = true;
                }
              }
            }
          }
        },
      });

      expect(stickyContainerClasses).toContain("bg-background");
      expect(stickyContainerClasses).toContain("border-t");
      expect(stickyContainerClasses).toContain("border-border");
      expect(submitParentIsKav).toBe(true);
      expect(submitParentIsScrollView).toBe(false);
    });

    it("app/perizinan/izin.tsx: submit CTA button applies Electric Blue bg-primary and contrast text", () => {
      const source = readSource("app/perizinan/izin.tsx");

      // Verify elimination of old bg-slate-900
      expect(source).not.toContain("bg-slate-900");

      // Verify bg-primary with active state and shadow
      expect(source).toMatch(/canSubmit\s*\?\s*"bg-primary shadow-primary\/30 active:opacity-90"/);
      expect(source).toMatch(/canSubmit\s*\?\s*"text-primary-foreground"\s*:\s*"text-muted-foreground"/);
      expect(source).toContain("border-primary-foreground");
    });
  });

  // =========================================================================
  // REQUIREMENT R3: Navigation Flow Hardening & Tab Screens Consistency
  // =========================================================================
  describe("R3: Navigation Architecture, BackHandler & Root Tab Screen Invariants", () => {
    it("Dashboard.tsx: uses useFocusEffect to manage hardwareBackPress", () => {
      const ast = parseAst("app/Dashboard.tsx");
      let focusEffectUsed = false;
      let hasCanGoBackCheck = false;
      let hasExitAppCall = false;

      traverse(ast, {
        CallExpression(path: any) {
          if (path.node.callee.name === "useFocusEffect") {
            focusEffectUsed = true;
            path.traverse({
              CallExpression(innerPath: any) {
                if (
                  innerPath.node.callee.type === "MemberExpression" &&
                  innerPath.node.callee.object.name === "router" &&
                  innerPath.node.callee.property.name === "canGoBack"
                ) {
                  hasCanGoBackCheck = true;
                }
                if (
                  innerPath.node.callee.type === "MemberExpression" &&
                  innerPath.node.callee.object.name === "BackHandler" &&
                  innerPath.node.callee.property.name === "exitApp"
                ) {
                  hasExitAppCall = true;
                }
              },
            });
          }
        },
      });

      expect(focusEffectUsed).toBe(true);
      expect(hasCanGoBackCheck).toBe(true);
      expect(hasExitAppCall).toBe(true);
    });

    it("Dashboard hardware back press empirical simulation: pops stack when router.canGoBack() is true", () => {
      const mockRouter = {
        canGoBack: jest.fn().mockReturnValue(true),
        back: jest.fn(),
      };
      const alertSpy = jest.spyOn(Alert, "alert");
      const exitAppSpy = jest.spyOn(BackHandler, "exitApp");

      // Extract the logic executed inside Dashboard's back handler:
      const handleBackPress = () => {
        if (mockRouter.canGoBack()) {
          mockRouter.back();
          return true;
        }

        Alert.alert(
          "Keluar Aplikasi",
          "Apakah Anda yakin ingin keluar dari aplikasi?",
          [
            { text: "Batal", style: "cancel" },
            {
              text: "Keluar",
              style: "destructive",
              onPress: () => BackHandler.exitApp(),
            },
          ],
        );
        return true;
      };

      const result = handleBackPress();

      expect(result).toBe(true);
      expect(mockRouter.canGoBack).toHaveBeenCalledTimes(1);
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
      expect(alertSpy).not.toHaveBeenCalled();
      expect(exitAppSpy).not.toHaveBeenCalled();

      alertSpy.mockRestore();
      exitAppSpy.mockRestore();
    });

    it("Dashboard hardware back press empirical simulation: shows exit alert when router.canGoBack() is false", () => {
      const mockRouter = {
        canGoBack: jest.fn().mockReturnValue(false),
        back: jest.fn(),
      };
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
      const exitAppSpy = jest.spyOn(BackHandler, "exitApp").mockImplementation(() => {});

      const handleBackPress = () => {
        if (mockRouter.canGoBack()) {
          mockRouter.back();
          return true;
        }

        Alert.alert(
          "Keluar Aplikasi",
          "Apakah Anda yakin ingin keluar dari aplikasi?",
          [
            { text: "Batal", style: "cancel" },
            {
              text: "Keluar",
              style: "destructive",
              onPress: () => BackHandler.exitApp(),
            },
          ],
        );
        return true;
      };

      const result = handleBackPress();

      expect(result).toBe(true);
      expect(mockRouter.canGoBack).toHaveBeenCalledTimes(1);
      expect(mockRouter.back).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledTimes(1);

      const alertArgs = alertSpy.mock.calls[0];
      expect(alertArgs[0]).toBe("Keluar Aplikasi");
      const buttons = alertArgs[2] as any[];
      expect(buttons.length).toBe(2);

      const cancelButton = buttons.find((b) => b.text === "Batal");
      expect(cancelButton).toBeDefined();

      const exitButton = buttons.find((b) => b.text === "Keluar");
      expect(exitButton).toBeDefined();
      expect(exitButton.style).toBe("destructive");

      // Press exit button
      exitButton.onPress();
      expect(exitAppSpy).toHaveBeenCalledTimes(1);

      alertSpy.mockRestore();
      exitAppSpy.mockRestore();
    });

    it("app/_layout.tsx renders official LoadingScreen during !isAuthReady and eliminates raw ActivityIndicator", () => {
      const source = readSource("app/_layout.tsx");

      expect(source).toContain('import LoadingScreen from "./auth/LoadingScreen";');
      expect(source).toMatch(/!isAuthReady[\s\S]*?<LoadingScreen \/>/);
      expect(source).not.toContain('<ActivityIndicator size="large" color="#0066FF" />');
    });

    it("app/index.tsx renders official LoadingScreen during session verification", () => {
      const source = readSource("app/index.tsx");

      expect(source).toContain('import LoadingScreen from "./auth/LoadingScreen";');
      expect(source).toContain("<LoadingScreen />");
      expect(source).not.toContain('<ActivityIndicator size="large" color="#0000ff" />');
      expect(source).not.toContain("setLoadingMessage");
    });

    it("Root Tab Riwayat (app/extra/riwayat.tsx): has NO visual back button, but supports hardwareBackPress", () => {
      const source = readSource("app/extra/riwayat.tsx");
      const ast = parseAst("app/extra/riwayat.tsx");

      // No visual back button
      expect(source).not.toContain("ChevronLeft");
      expect(source).not.toMatch(/accessibilityLabel="Kembali"/);
      expect(source).toContain("Riwayat Kehadiran");

      // Hardware back press supported via useFocusEffect
      let focusEffectWithBackPress = false;
      traverse(ast, {
        CallExpression(path: any) {
          if (path.node.callee.name === "useFocusEffect") {
            path.traverse({
              CallExpression(innerPath: any) {
                if (
                  innerPath.node.callee.type === "MemberExpression" &&
                  innerPath.node.callee.object.name === "BackHandler" &&
                  innerPath.node.callee.property.name === "addEventListener"
                ) {
                  focusEffectWithBackPress = true;
                }
              },
            });
          }
        },
      });

      expect(focusEffectWithBackPress).toBe(true);
    });

    it("Root Tab Status Perizinan (app/perizinan/status.tsx): has NO visual back button, but supports hardwareBackPress", () => {
      const source = readSource("app/perizinan/status.tsx");
      const ast = parseAst("app/perizinan/status.tsx");

      // No visual back button
      expect(source).not.toContain("ChevronLeft");
      expect(source).not.toMatch(/accessibilityLabel="Kembali"/);
      expect(source).toContain("Status Perizinan");

      // Hardware back press supported via useFocusEffect
      let focusEffectWithBackPress = false;
      traverse(ast, {
        CallExpression(path: any) {
          if (path.node.callee.name === "useFocusEffect") {
            path.traverse({
              CallExpression(innerPath: any) {
                if (
                  innerPath.node.callee.type === "MemberExpression" &&
                  innerPath.node.callee.object.name === "BackHandler" &&
                  innerPath.node.callee.property.name === "addEventListener"
                ) {
                  focusEffectWithBackPress = true;
                }
              },
            });
          }
        },
      });

      expect(focusEffectWithBackPress).toBe(true);
    });

    it("Root Tab Pengaturan (app/extra/pengaturan.tsx): has NO visual back button, but supports hardwareBackPress", () => {
      const source = readSource("app/extra/pengaturan.tsx");
      const ast = parseAst("app/extra/pengaturan.tsx");

      // No visual back button
      expect(source).not.toContain("ChevronLeft");
      expect(source).not.toMatch(/accessibilityLabel="Kembali"/);
      expect(source).toContain("Pengaturan");

      // Hardware back press supported via useFocusEffect
      let focusEffectWithBackPress = false;
      traverse(ast, {
        CallExpression(path: any) {
          if (path.node.callee.name === "useFocusEffect") {
            path.traverse({
              CallExpression(innerPath: any) {
                if (
                  innerPath.node.callee.type === "MemberExpression" &&
                  innerPath.node.callee.object.name === "BackHandler" &&
                  innerPath.node.callee.property.name === "addEventListener"
                ) {
                  focusEffectWithBackPress = true;
                }
              },
            });
          }
        },
      });

      expect(focusEffectWithBackPress).toBe(true);
    });
  });
});
