export class ValueFinderPage {
  constructor(page) {
    this.page = page;
  }

  async selectVehicle(vehicle) {
    await this.selectOptionByName(0, vehicle.make);
    await this.selectOptionByName(1, vehicle.model);
    await this.selectOptionByName(2, vehicle.variant);
    await this.selectOptionByName(3, String(vehicle.year));
    await this.selectOptionByName(4, "2WD");
    await this.selectOptionByName(5, "Agriculture");
  }

  async selectOptionByName(index, name) {
    await this.page.getByRole("combobox").nth(index).click();
    await this.page.getByRole("option", { name, exact: true }).click();
  }

  async search() {
    await this.page.getByRole("button", { name: "Get Value", exact: true }).click();
    await this.page.getByRole("button", { name: "Download PDF", exact: true }).waitFor();
  }
}
