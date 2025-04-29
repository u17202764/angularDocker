import {Component, OnInit} from '@angular/core';
import {Categoria, CategoryService} from "../../CategoryService";
import {CommonModule} from "@angular/common";

@Component({
  selector: 'app-listado',
  standalone: true,
  imports: [CommonModule],  // <-- Asegúrate de importar CommonModule
  templateUrl: './listado.component.html',
  styleUrl: './listado.component.scss'
})
export class ListadoComponent implements OnInit {
  categorias: Categoria[] = [];

  constructor(private categoriaService: CategoryService) {}

  ngOnInit(): void {
    this.categoriaService.getItems().subscribe(data => {
      console.log(data);
      this.categorias = data;
    });
  }
}
