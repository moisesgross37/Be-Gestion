import csv

def flatten_csv(input_filepath, output_filepath):
    with open(input_filepath, 'r', newline='', encoding='utf-8') as infile:
        reader = csv.reader(infile)
        header = next(reader)  # Read header

        with open(output_filepath, 'w', newline='', encoding='utf-8') as outfile:
            writer = csv.writer(outfile)
            writer.writerow(header)  # Write header to output

            last_category = ""
            for row in reader:
                if row:
                    if row[0]:  # If the first column is not empty
                        last_category = row[0]
                        writer.writerow(row)
                    else:  # If the first column is empty
                        new_row = [last_category] + row[1:]
                        writer.writerow(new_row)

if __name__ == "__main__":
    input_file = "/Users/moisesgross/Desktop/Trabajo Gemini/Productos.csv"
    output_file = "/Users/moisesgross/Desktop/Trabajo Gemini/productos_corregido.csv"
    flatten_csv(input_file, output_file)